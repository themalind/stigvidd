using System.Text;
using OpenTelemetry;
using OpenTelemetry.Exporter;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace StigviddAPI.Extensions;

/// <summary>
/// OpenTelemetry wiring: logs, traces and metrics exported over OTLP/HTTP to the
/// self-hosted OpenObserve instance (see docs/observability.md).
///
/// Telemetry is strictly OPT-IN. With no <c>Otlp:Endpoint</c> configured this registers
/// nothing at all — no providers, no exporters, no background export threads. That is a
/// registration-time guard, not a runtime flag, and the distinction matters: it is what
/// keeps `dotnet run` on a laptop, CI, and every WebApplicationFactory integration test
/// free of export threads and outbound connection attempts.
/// </summary>
public static class TelemetryExtensions
{
    // One API service, so this is a constant rather than config: making it configurable
    // only invites environments drifting apart and queries silently missing data.
    private const string ServiceName = "stigvidd-api";

    // OpenObserve routes records into a stream selected by this header. Traces and metrics
    // land in their own stores regardless, but logs need it or they all pile into `default`.
    private const string StreamHeaderName = "stream-name";

    public static IHostApplicationBuilder AddStigViddTelemetry(this IHostApplicationBuilder builder)
    {
        // OTEL_EXPORTER_OTLP_ENDPOINT is honoured as a fallback so the standard
        // OpenTelemetry variable works for anyone who reaches for it out of habit.
        var endpoint = builder.Configuration["Otlp:Endpoint"]
            ?? builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];

        if (string.IsNullOrWhiteSpace(endpoint))
        {
            return builder;
        }

        // Fail loudly rather than silently dropping every export: a typo here is the
        // difference between "observability is on" and "observability looks on".
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var endpointUri))
        {
            throw new InvalidOperationException(
                $"Otlp:Endpoint '{endpoint}' is not an absolute URI. Expected the OpenObserve "
                + "ingest base for the org, e.g. http://openobserve:5080/api/default — with no "
                + "signal path; /v1/logs, /v1/traces and /v1/metrics are appended per signal.");
        }

        var serviceVersion = builder.Configuration["Otlp:ServiceVersion"] ?? "unknown";

        // Built once and shared: the credentials are identical per signal, only the target
        // stream differs.
        var authHeader = BuildAuthHeader(builder.Configuration);
        var logStream = builder.Configuration["Otlp:LogStream"] ?? "stigvidd_api_logs";

        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.SetResourceBuilder(BuildResource(builder.Environment, serviceVersion));

            // Without these an OTLP record carries only the raw template. With them
            // OpenObserve gets the rendered message AND the named placeholders as queryable
            // fields, which is what makes the existing "{FacilityId}"-style templates worth
            // having instead of interpolated strings.
            logging.IncludeFormattedMessage = true;
            logging.IncludeScopes = true;
            logging.ParseStateValues = true;

            logging.AddOtlpExporter(o => Configure(o, endpointUri, "v1/logs", authHeader, logStream));
        });

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => ConfigureResource(resource, builder.Environment, serviceVersion))
            .WithTracing(tracing => tracing
                .AddAspNetCoreInstrumentation(o =>
                {
                    o.Filter = IsWorthTracing;
                    o.RecordException = true;
                })
                .AddHttpClientInstrumentation(o =>
                {
                    // Belt and braces against a telemetry-about-telemetry loop: the exporter's
                    // own egress is already suppressed internally, but an explicit filter makes
                    // it impossible to reintroduce by accident.
                    o.FilterHttpRequestMessage = request =>
                        request.RequestUri is null
                        || !string.Equals(request.RequestUri.Host, endpointUri.Host, StringComparison.OrdinalIgnoreCase);
                })
                // Npgsql 10 ships its own ActivitySource — this is exactly what
                // Npgsql.OpenTelemetry's AddNpgsql() does internally, without the package.
                .AddSource("Npgsql")
                .AddOtlpExporter(o => Configure(o, endpointUri, "v1/traces", authHeader, stream: null)))
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation()
                // Connection-pool saturation, which is the single most useful number when
                // someone reports "the API got slow".
                .AddMeter("Npgsql")
                .AddOtlpExporter(o => Configure(o, endpointUri, "v1/metrics", authHeader, stream: null)));

        return builder;
    }

    /// <summary>
    /// Applies one signal's exporter settings.
    ///
    /// The signal path is appended HERE, deliberately. The SDK only appends `/v1/traces` and
    /// friends when the endpoint comes from the OTEL_EXPORTER_OTLP_ENDPOINT *environment
    /// variable*; assigning <see cref="OtlpExporterOptions.Endpoint"/> in code means "this is
    /// the complete URL". Leaving it bare posts every batch to the org root, which OpenObserve
    /// answers with 404 — silently, because export failures never surface as app errors.
    /// </summary>
    private static void Configure(
        OtlpExporterOptions options,
        Uri endpoint,
        string signalPath,
        string authHeader,
        string? stream)
    {
        // Tolerate a trailing slash on the configured base rather than emitting `//v1/logs`.
        options.Endpoint = new Uri($"{endpoint.AbsoluteUri.TrimEnd('/')}/{signalPath}");
        options.Protocol = OtlpExportProtocol.HttpProtobuf;
        options.Headers = stream is null ? authHeader : $"{authHeader},{StreamHeaderName}={stream}";
    }

    private static ResourceBuilder BuildResource(IHostEnvironment environment, string serviceVersion)
    {
        var resource = ResourceBuilder.CreateDefault();
        ConfigureResource(resource, environment, serviceVersion);

        return resource;
    }

    private static void ConfigureResource(ResourceBuilder resource, IHostEnvironment environment, string serviceVersion)
    {
        resource
            .AddService(serviceName: ServiceName, serviceVersion: serviceVersion, serviceInstanceId: Environment.MachineName)
            .AddAttributes([new KeyValuePair<string, object>("deployment.environment", environment.EnvironmentName)]);
    }

    /// <summary>
    /// Drops spans that are pure noise. Health probes fire every few seconds forever,
    /// Swagger/OpenAPI is dev-only browsing that emits a burst of spans per page load, and
    /// CORS preflights double the span count for every mutating call from the app (the
    /// AllowFrontend policy reflects any origin in Development).
    /// </summary>
    private static bool IsWorthTracing(HttpContext context)
    {
        if (HttpMethods.IsOptions(context.Request.Method))
        {
            return false;
        }

        var path = context.Request.Path;

        return !path.StartsWithSegments("/healthz")
            && !path.StartsWithSegments("/readyz")
            && !path.StartsWithSegments("/swagger")
            && !path.StartsWithSegments("/openapi");
    }

    /// <summary>
    /// Builds the Basic credentials OpenObserve expects for OTLP ingest.
    ///
    /// Assembled here from a plain username/password so the deployment secret stays a
    /// readable password in the host `.env` rather than an opaque pre-encoded blob — and so
    /// that each signal can carry its own stream-name, which a single
    /// OTEL_EXPORTER_OTLP_HEADERS string cannot express. It also sidesteps
    /// open-telemetry/opentelemetry-dotnet#5315: the .NET SDK does not URL-decode that
    /// variable, so a spec-correct percent-encoded value is sent literally and rejected as a
    /// 401 that looks exactly like a wrong password.
    ///
    /// Base64 padding is safe in the header string: the exporter splits each comma-separated
    /// pair on the FIRST '=' only, and base64 never contains a comma.
    /// </summary>
    private static string BuildAuthHeader(IConfiguration configuration)
    {
        // Escape hatch for anything exotic: a fully pre-formed header string wins.
        var raw = configuration["Otlp:Headers"];
        if (!string.IsNullOrWhiteSpace(raw))
        {
            return raw;
        }

        var user = configuration["Otlp:Username"];
        var password = configuration["Otlp:Password"];

        if (string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                "Otlp:Endpoint is set, so Otlp:Username and Otlp:Password must be too "
                + "(or Otlp:Headers, to supply the header string verbatim). Use the dedicated "
                + "ingest account from DEPLOYMENT.md Part 1 step 8, not the root account.");
        }

        var basicAuth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{user}:{password}"));

        return $"Authorization=Basic {basicAuth}";
    }
}
