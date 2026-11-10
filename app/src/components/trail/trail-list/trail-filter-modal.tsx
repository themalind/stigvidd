// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import FilterSheet, { FilterSection, filterSectionTitleStyle } from "@/components/filter/filter-sheet";
import OptionGroup from "@/components/filter/option-group";
import ReleasedSlider from "@/components/filter/released-slider";
import SelectInput from "@/components/form/select-input";
import { FilterOptions } from "@/data/types";
import { SortOption } from "@/hooks/trail/useTrailFilters";
import { classificationParser } from "@/utils/classification-parser";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

// Minimum-rating steps; undefined is the "all ratings" button.
const RATING_STEPS: (number | undefined)[] = [undefined, 3, 4, 4.5];

// 4.5 reads as "4,5" in Swedish and "4.5" in English; whole steps carry no decimal.
const formatRating = (value: number) => (Number.isInteger(value) ? String(value) : value.toLocaleString());

interface TrailFilterModalProps {
  visible: boolean;
  onClose: () => void;
  cities: string[];
  classifications: number[];
  filters: FilterOptions;
  sortBy: SortOption;
  onUpdateSort: (value: SortOption) => void;
  onUpdateFilter: (key: keyof FilterOptions, value: any) => void;
  onUpdateLengthFilter: (min: number, max: number) => void;
  onClearFilters: () => void;
  hasLocation: boolean;
  showSort?: boolean;
  // Overrides the default header, "Filter & Sortering".
  title?: string;
}

export const TrailFilterModal: React.FC<TrailFilterModalProps> = ({
  visible,
  onClose,
  cities,
  classifications,
  filters,
  sortBy,
  onUpdateFilter,
  onUpdateLengthFilter,
  onUpdateSort,
  onClearFilters,
  hasLocation,
  showSort = true,
  title,
}) => {
  const { t } = useTranslation();

  // Stable identities: a fresh array here rebuilds every option row on each render.
  const cityOptions = useMemo(
    () => [{ label: t("filter.allCities"), value: "" }, ...cities.map((city) => ({ label: city, value: city }))],
    [cities, t],
  );

  const classificationOptions = useMemo(
    () => [
      { label: t("filter.allDifficulties"), value: "" },
      ...classifications.map((c) => ({ label: classificationParser(c), value: String(c) })),
    ],
    [classifications, t],
  );

  const sortOptions = useMemo(
    () => [
      { label: t("filter.sortRatingDesc"), value: "rating-desc" },
      { label: t("filter.sortNameAsc"), value: "name-asc" },
      { label: t("filter.sortNameDesc"), value: "name-desc" },
      { label: t("filter.sortLengthAsc"), value: "length-asc" },
      { label: t("filter.sortLengthDesc"), value: "length-desc" },
      ...(hasLocation ? [{ label: t("filter.sortNearest"), value: "distance-asc" }] : []),
    ],
    [hasLocation, t],
  );

  return (
    <FilterSheet visible={visible} title={title ?? t("filter.title")} onClear={onClearFilters} onClose={onClose}>
      <FilterSection title={t("filter.city")}>
        <SelectInput
          selectedValue={filters.city || ""}
          onValueChange={(value) => onUpdateFilter("city", value === "" ? undefined : value)}
          options={cityOptions}
        />
      </FilterSection>

      <FilterSection title={t("filter.accessibility")}>
        <OptionGroup
          options={[
            { value: undefined, label: t("filter.all"), testID: "filter-accessibility-all" },
            {
              value: true,
              label: t("filter.adapted"),
              testID: "filter-accessibility-adapted",
              icon: "wheelchair-accessibility",
            },
          ]}
          value={filters.accessibility === true ? true : undefined}
          onChange={(value) => onUpdateFilter("accessibility", value)}
        />
      </FilterSection>

      {hasLocation && (
        <FilterSection title={t("filter.nearMe")}>
          <OptionGroup
            options={[
              { value: false, label: t("filter.all"), testID: "filter-nearme-all" },
              { value: true, label: t("filter.nearMe"), testID: "filter-nearme-on" },
            ]}
            value={filters.nearMe === true}
            onChange={(value) => onUpdateFilter("nearMe", value ? true : undefined)}
          />
          {filters.nearMe && (
            <ReleasedSlider
              value={[filters.maxDistance ?? 50]}
              minimumValue={5}
              maximumValue={200}
              step={5}
              label={([distance]) => t("filter.maxDistance", { distance })}
              onCommit={([distance]) => onUpdateFilter("maxDistance", distance)}
            />
          )}
        </FilterSection>
      )}

      <FilterSection title={t("filter.difficulty")}>
        <SelectInput
          selectedValue={filters.classification !== undefined ? String(filters.classification) : ""}
          onValueChange={(value) => onUpdateFilter("classification", value === "" ? undefined : Number(value))}
          options={classificationOptions}
        />
      </FilterSection>

      <FilterSection title={t("filter.rating")}>
        <OptionGroup
          options={RATING_STEPS.map((step) => ({
            value: step,
            label: step === undefined ? t("filter.all") : `${formatRating(step)}+`,
            testID: `filter-rating-${step === undefined ? "all" : String(step).replace(".", "-")}`,
          }))}
          value={filters.minRating}
          onChange={(step) => onUpdateFilter("minRating", step)}
        />
      </FilterSection>

      <FilterSection>
        <ReleasedSlider
          value={[filters.minLength ?? 0, filters.maxLength ?? 150]}
          minimumValue={0}
          maximumValue={150}
          step={1}
          labelStyle={filterSectionTitleStyle}
          label={([min, max]) => t("filter.trailLength", { min, max })}
          onCommit={([min, max]) => onUpdateLengthFilter(min, max)}
        />
      </FilterSection>

      {/* Hidden where sorting lives in the list header's popover instead. */}
      {showSort && (
        <FilterSection title={t("filter.sortBy")}>
          <SelectInput
            selectedValue={sortBy}
            onValueChange={(v) => onUpdateSort(v as SortOption)}
            options={sortOptions}
          />
        </FilterSection>
      )}
    </FilterSheet>
  );
};
