// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import FilterSheet, { FilterSection } from "@/components/filter/filter-sheet";
import OptionGroup from "@/components/filter/option-group";
import ReleasedSlider from "@/components/filter/released-slider";
import SwitchRow from "@/components/filter/switch-row";
import { EventRouteKind, EventSort } from "@/data/types";
import { EventSearch } from "@/hooks/events/useEventSearch";
import { EventLength, EventWhen, RADIUS_KM } from "@/utils/event-search";
import { paperDatesLocale } from "@/utils/paper-dates-locale";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DatePickerModal } from "react-native-paper-dates";

type Props = {
  visible: boolean;
  onClose: () => void;
  search: EventSearch;
  // Past lists have no date choice; the windows only look ahead. keep-comment: why it can be hidden
  showWhen: boolean;
};

function formatDay(date: Date, language: string): string {
  return date.toLocaleDateString(language, { day: "numeric", month: "short" });
}

export default function EventFilterSheet({ visible, onClose, search, showWhen }: Props) {
  const { t, i18n } = useTranslation();
  const [pickingRange, setPickingRange] = useState(false);
  const { filters, update, clearFilters, hasLocation } = search;
  const range = filters.customRange;

  const customLabel = range
    ? t("events.search.customRange", {
        from: formatDay(range.from, i18n.language),
        to: formatDay(range.to, i18n.language),
      })
    : t("events.search.custom");

  const chooseWhen = (when: EventWhen | undefined) => {
    if (when === "custom") {
      setPickingRange(true);
      return;
    }
    update({ when });
  };

  return (
    <FilterSheet visible={visible} title={t("events.search.filterTitle")} onClear={clearFilters} onClose={onClose}>
      {hasLocation ? (
        <FilterSection title={t("events.search.sort")}>
          <OptionGroup<EventSort>
            options={[
              { value: "Date", label: t("events.search.sortDate"), testID: "event-sort-date" },
              { value: "Distance", label: t("events.search.sortDistance"), testID: "event-sort-distance" },
            ]}
            value={filters.sort}
            onChange={(sort) => update({ sort })}
          />
        </FilterSection>
      ) : null}

      {showWhen ? (
        <FilterSection title={t("events.search.when")}>
          <OptionGroup<EventWhen | undefined>
            layout="wrap"
            options={[
              { value: undefined, label: t("events.search.any"), testID: "event-when-any" },
              { value: "today", label: t("events.search.today"), testID: "event-when-today" },
              { value: "weekend", label: t("events.search.weekend"), testID: "event-when-weekend" },
              { value: "week", label: t("events.search.week"), testID: "event-when-week" },
              { value: "month", label: t("events.search.month"), testID: "event-when-month" },
              { value: "custom", label: customLabel, testID: "event-when-custom" },
            ]}
            value={filters.when}
            onChange={chooseWhen}
          />
        </FilterSection>
      ) : null}

      {hasLocation ? (
        <FilterSection title={t("events.search.distance")}>
          <SwitchRow
            testID="event-filter-near-me"
            label={t("events.search.nearMe")}
            value={filters.nearMe}
            onValueChange={(nearMe) => update({ nearMe })}
          />
          {filters.nearMe ? (
            <ReleasedSlider
              value={[filters.radiusKm]}
              minimumValue={RADIUS_KM.min}
              maximumValue={RADIUS_KM.max}
              step={RADIUS_KM.step}
              label={([km]) => t("events.search.within", { km })}
              onCommit={([radiusKm]) => update({ radiusKm })}
            />
          ) : null}
        </FilterSection>
      ) : null}

      <FilterSection title={t("events.search.spots")}>
        <SwitchRow
          testID="event-filter-spots"
          label={t("events.search.onlyWithSpots")}
          hint={t("events.search.onlyWithSpotsHint")}
          value={filters.onlyWithSpots}
          onValueChange={(onlyWithSpots) => update({ onlyWithSpots })}
        />
      </FilterSection>

      <FilterSection title={t("events.search.length")}>
        <OptionGroup<EventLength | undefined>
          layout="wrap"
          options={[
            { value: undefined, label: t("events.search.any"), testID: "event-length-any" },
            { value: "short", label: t("events.search.lengthShort"), testID: "event-length-short" },
            { value: "mid", label: t("events.search.lengthMid"), testID: "event-length-mid" },
            { value: "long", label: t("events.search.lengthLong"), testID: "event-length-long" },
          ]}
          value={filters.length}
          onChange={(length) => update({ length })}
        />
      </FilterSection>

      <FilterSection title={t("events.search.route")}>
        <OptionGroup<EventRouteKind | undefined>
          layout="wrap"
          options={[
            { value: undefined, label: t("events.search.any"), testID: "event-route-any" },
            { value: "Trail", label: t("events.search.routeTrail"), testID: "event-route-trail" },
            { value: "Own", label: t("events.search.routeOwn"), testID: "event-route-own" },
          ]}
          value={filters.routeKind}
          onChange={(routeKind) => update({ routeKind })}
        />
      </FilterSection>

      <DatePickerModal
        locale={paperDatesLocale(i18n.language)}
        mode="range"
        visible={pickingRange}
        startDate={range?.from}
        endDate={range?.to}
        validRange={{ startDate: new Date() }}
        label={t("events.search.pickRange")}
        saveLabel={t("common.done")}
        onDismiss={() => setPickingRange(false)}
        onConfirm={({ startDate, endDate }) => {
          setPickingRange(false);
          if (startDate) update({ when: "custom", customRange: { from: startDate, to: endDate ?? startDate } });
        }}
      />
    </FilterSheet>
  );
}
