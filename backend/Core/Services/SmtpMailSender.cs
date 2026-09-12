// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace Core.Services;

// Submits to the mail server on 587 over STARTTLS. Configuration comes from the Smtp section,
// which docker-compose.yml sets on the api service; nothing here belongs in appsettings.json,
// and its absence is what selects LoggingMailSender instead.
public class SmtpMailSender : IMailSender
{
    private const int DefaultPort = 587;

    private readonly ILogger<SmtpMailSender> _logger;
    private readonly string _host;
    private readonly int _port;
    private readonly string? _user;
    private readonly string? _password;
    private readonly string _from;

    public SmtpMailSender(IConfiguration configuration, ILogger<SmtpMailSender> logger)
    {
        _logger = logger;

        _host = configuration["Smtp:Host"]
            ?? throw new InvalidOperationException("Smtp:Host configuration is missing");

        _port = int.TryParse(configuration["Smtp:Port"], out var configured) ? configured : DefaultPort;

        _user = configuration["Smtp:User"];
        _password = configuration["Smtp:Password"];

        // Falling back to the submission account keeps a half-configured stack sending from a
        // sane address rather than from whatever Postfix decides the local user is.
        _from = configuration["Smtp:From"] ?? _user
            ?? throw new InvalidOperationException("Smtp:From or Smtp:User configuration is required");
    }

    public async Task<MailSendResult> SendAsync(OutboxEmail email, CancellationToken ctoken)
    {
        try
        {
            var message = new MimeMessage();
            message.From.Add(MailboxAddress.Parse(_from));
            message.To.Add(string.IsNullOrWhiteSpace(email.ToName)
                ? MailboxAddress.Parse(email.ToAddress)
                : new MailboxAddress(email.ToName, email.ToAddress));
            message.Subject = email.Subject;

            // multipart/alternative. A mail with no text part is both unreadable in a plain
            // text client and a spam-score penalty in everyone else's.
            message.Body = new BodyBuilder
            {
                HtmlBody = email.BodyHtml,
                TextBody = email.BodyText,
            }.ToMessageBody();

            using var client = new SmtpClient();

            // StartTlsWhenAvailable, not StartTls: the same code then works against a local
            // test server with no certificate. The deployed host is the mail server's network
            // alias, so its certificate matches and TLS is used.
            await client.ConnectAsync(_host, _port, SecureSocketOptions.StartTlsWhenAvailable, ctoken);

            if (!string.IsNullOrWhiteSpace(_user))
                await client.AuthenticateAsync(_user, _password ?? string.Empty, ctoken);

            await client.SendAsync(message, ctoken);
            await client.DisconnectAsync(true, ctoken);

            return MailSendResult.Ok();
        }
        catch (SmtpCommandException ex) when ((int)ex.StatusCode >= 500)
        {
            // A 5xx is the server refusing the message itself — no such mailbox, sender not
            // permitted. Retrying asks the same question and gets the same answer.
            _logger.LogError(ex, "SmtpMailSender: SendAsync -> Mail {identifier} was rejected permanently ({status}).", email.Identifier, ex.StatusCode);
            return MailSendResult.PermanentFailure($"{ex.StatusCode}: {ex.Message}");
        }
        catch (Exception ex)
        {
            // Everything else — connection refused, timeout, a 4xx greylisting reply — is
            // worth another attempt. Greylisting in particular is designed to be retried, and
            // Rspamd has it enabled on this mail server.
            _logger.LogWarning(ex, "SmtpMailSender: SendAsync -> Mail {identifier} could not be sent; will retry.", email.Identifier);
            return MailSendResult.Transient(ex.Message);
        }
    }
}
