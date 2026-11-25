// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Trail;

public class TrailResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required decimal TrailLength { get; set; }
    public required int Classification { get; set; }
    public required bool Accessibility { get; set; }
    public required string AccessibilityInfo { get; set; }
    public required string TrailSymbol { get; set; }
    public required string TrailSymbolImage { get; set; }
    public required string Description { get; set; }
    public required string FullDescription { get; set; }
    public string? Coordinates { get; set; }
    public required string Tags { get; set; }
    public required string CreatedBy { get; set; }
    public required bool IsVerified { get; set; }
    public required string City { get; set; }

    public VisitorInformationResponse? VisitorInformation { get; set; }
    public TrailContributionResponse? Contribution { get; set; }
    public IReadOnlyCollection<TrailImageResponse>? TrailImagesResponse { get; set; }
    public IReadOnlyCollection<TrailLinkResponse>? TrailLinksResponse { get; set; }

    public static TrailResponse Create(
        string identifier,
        string name,
        decimal trailLength,
        int classification,
        bool accessibility,
        string accessibilityInfo,
        string trailSymbol,
        string trailSymbolImage,
        string description,
        string fullDescription,
        string coordinates,
        string tags,
        string createdBy,
        bool isVerified,
        string city,
        IEnumerable<TrailImageResponse>? trailImages,
        IEnumerable<TrailLinkResponse>? trailLinks,
        VisitorInformationResponse? visitorInformationResponse)

    {
        return new TrailResponse
        {
            Identifier = identifier,
            Name = name,
            TrailLength = trailLength,
            Classification = classification,
            Accessibility = accessibility,
            AccessibilityInfo = accessibilityInfo,
            TrailSymbol = trailSymbol,
            TrailSymbolImage = trailSymbolImage,
            Description = description,
            FullDescription = fullDescription,
            Coordinates = coordinates,
            Tags = tags,
            CreatedBy = createdBy,
            IsVerified = isVerified,
            City = city,
            TrailImagesResponse = trailImages?.ToList(),
            TrailLinksResponse = trailLinks?.ToList(),
            VisitorInformation = visitorInformationResponse
        };
    }

    public static TrailResponse Create(
       string identifier,
       string name,
       decimal trailLength,
       int classification,
       bool accessibility,
       string accessibilityInfo,
       string trailSymbol,
       string trailSymbolImage,
       string description,
       string fullDescription,
       string tags,
       string createdBy,
       bool isVerified,
       string city,
       IEnumerable<TrailImageResponse>? trailImages,
       IEnumerable<TrailLinkResponse>? trailLinks,
       VisitorInformationResponse? visitorInformationResponse)

    {
        return new TrailResponse
        {
            Identifier = identifier,
            Name = name,
            TrailLength = trailLength,
            Classification = classification,
            Accessibility = accessibility,
            AccessibilityInfo = accessibilityInfo,
            TrailSymbol = trailSymbol,
            TrailSymbolImage = trailSymbolImage,
            Description = description,
            FullDescription = fullDescription,
            Tags = tags,
            CreatedBy = createdBy,
            IsVerified = isVerified,
            City = city,
            TrailImagesResponse = trailImages?.ToList(),
            TrailLinksResponse = trailLinks?.ToList(),
            VisitorInformation = visitorInformationResponse
        };
    }
}

