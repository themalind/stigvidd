// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The real package ships untranspiled ESM that Jest cannot parse. The pickers render nothing and
// keep their last visible props on mockPickers, so a test can confirm or dismiss them.
const mockPickers = { date: null, time: null };

module.exports = {
  mockPickers,
  registerTranslation: () => undefined,
  sv: {},
  en: {},
  DatePickerModal: (props) => {
    mockPickers.date = props.visible ? props : null;
    return null;
  },
  TimePickerModal: (props) => {
    mockPickers.time = props.visible ? props : null;
    return null;
  },
};
