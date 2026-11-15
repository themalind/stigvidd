// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text;

namespace Core.Services.Facilities;

// keep-comment: one rule for "the same place", used by the import's suggestions and the admin list's duplicates
public static class FacilityNames
{
    private static readonly string[] Noise =
        ["kommunala", "badplatsen", "badplats", "grillplatsen", "grillplats", "vindskyddet", "vindskydd"];

    public static string Key(string name)
    {
        var builder = new StringBuilder();

        foreach (var c in name.ToLowerInvariant())
            builder.Append(char.IsLetterOrDigit(c) ? c : ' ');

        var words = builder.ToString()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => !Noise.Contains(w) && !Noise.Contains(WithoutGenitive(w)))
            .Select(WithoutGenitive);

        return string.Join(' ', words);
    }

    // keep-comment: hand-typed names are often genitive ("Dalsjöns badplats") where the source has "Dalsjön badplats"
    private static string WithoutGenitive(string word)
    {
        return word.Length > 3 && word.EndsWith('s') ? word[..^1] : word;
    }
}
