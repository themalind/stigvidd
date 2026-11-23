// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Logging;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace Core.Services.Mail;

// keep-comment: Smtp is set by docker-compose only; its absence selects LoggingMailSender
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

        // keep-comment: else Postfix picks the sender from its local user
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

            // keep-comment: a mail without a text part costs spam score
            message.Body = new BodyBuilder
            {
                HtmlBody = email.BodyHtml,
                TextBody = email.BodyText,
            }.ToMessageBody();

            using var client = new SmtpClient();

            // keep-comment: WhenAvailable so a local test server without a certificate works
            await client.ConnectAsync(_host, _port, SecureSocketOptions.StartTlsWhenAvailable, ctoken);

            if (!string.IsNullOrWhiteSpace(_user))
                await client.AuthenticateAsync(_user, _password ?? string.Empty, ctoken);

            await client.SendAsync(new SendRequest(message), ctoken);
            await client.DisconnectAsync(true, ctoken);

            return MailSendResult.Ok();
        }
        catch (SmtpCommandException ex) when ((int)ex.StatusCode >= 500)
        {
            // keep-comment: a 5xx refuses the message itself, so a retry gets the same answer
            _logger.LogError(
                "SmtpMailSender: SendAsync -> Mail {identifier} was rejected permanently ({status}): {error}",
                email.Identifier, ex.StatusCode, LogRedaction.ScrubEmails(ex.Message));
            return MailSendResult.PermanentFailure($"{ex.StatusCode}: {ex.Message}");
        }
        catch (Exception ex)
        {
            // keep-comment: retried, since the mail server's Rspamd greylists with a 4xx
            if (ex is SmtpCommandException command)
            {
                _logger.LogWarning(
                    "SmtpMailSender: SendAsync -> Mail {identifier} could not be sent ({status}): {error}; will retry.",
                    email.Identifier, command.StatusCode, LogRedaction.ScrubEmails(command.Message));
            }
            else
            {
                _logger.LogWarning(ex, "SmtpMailSender: SendAsync -> Mail {identifier} could not be sent; will retry.", email.Identifier);
            }
            return MailSendResult.Transient(ex.Message);
        }
    }
}
