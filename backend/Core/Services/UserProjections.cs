// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Services;

internal record SenderProjection(int Id, string NickName);

internal record ReceiverProjection(int Id, string Identifier);
