// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.DataTransfer;

public class DataTransferInfoResponse
{
    // True on a host that borrows another host's Keycloak, mail server and observatory (staging). keep-comment: meaning of the flag is not in its name
    public required bool SharedServices { get; set; }
    public required bool ExportIncludesKeycloak { get; set; }
    public required bool ImportRestoresKeycloak { get; set; }
    public required bool ImportClearsOutbound { get; set; }
}
