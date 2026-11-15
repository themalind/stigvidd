// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { recountAfterMutations } from "@/api/attention";
import { createQueryClient } from "@/lib/react-query";

export const queryClient = createQueryClient();

recountAfterMutations(queryClient);
