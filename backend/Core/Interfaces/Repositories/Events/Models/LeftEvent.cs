// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Events.Models;

// HandOver is null unless the organizer left. keep-comment: a participant leaving tells no one
public sealed record LeftEvent(HandOverOutcome? HandOver);
