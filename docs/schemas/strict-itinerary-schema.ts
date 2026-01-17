/**
 * Strict JSON Schema for AI-generated itineraries
 * Enforces required fields and prevents null/empty values
 */

export const STRICT_ITINERARY_SCHEMA = {
  type: "object",
  properties: {
    days: {
      type: "array",
      description: "Array of daily itinerary plans",
      items: {
        type: "object",
        properties: {
          dayNumber: {
            type: "integer",
            minimum: 1,
            description: "Day number in the trip sequence",
          },
          date: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            description: "Date in YYYY-MM-DD format",
          },
          title: {
            type: "string",
            minLength: 3,
            maxLength: 100,
            description:
              "Short descriptive title for the day (e.g., 'Arrival & West End')",
          },
          activities: {
            type: "array",
            minItems: 1,
            description: "List of activities for this day",
            items: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  minLength: 3,
                  maxLength: 150,
                  description: "Activity name (e.g., 'Visit British Museum')",
                },
                startTime: {
                  type: "string",
                  pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
                  description: "Start time in HH:MM format (24-hour)",
                },
                endTime: {
                  type: "string",
                  pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
                  description:
                    "End time in HH:MM format (24-hour) - REQUIRED, every activity must end",
                },
                category: {
                  type: "string",
                  enum: [
                    "sightseeing",
                    "dining",
                    "cultural",
                    "shopping",
                    "relaxation",
                    "transport",
                    "accommodation",
                    "activity",
                  ],
                  description: "Type of activity",
                },
                location: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      minLength: 2,
                      description: "Venue or location name",
                    },
                    address: {
                      type: "string",
                      minLength: 10,
                      description: "Full street address including postal code",
                    },
                  },
                  required: ["name", "address"],
                  additionalProperties: false,
                },
                cost: {
                  type: "object",
                  properties: {
                    amount: {
                      type: "number",
                      minimum: 0,
                      description:
                        "Cost in local currency (use 0 for free activities)",
                    },
                    currency: {
                      type: "string",
                      enum: ["USD", "EUR", "GBP", "JPY", "AUD", "CAD"],
                      description: "Three-letter currency code",
                    },
                  },
                  required: ["amount", "currency"],
                  additionalProperties: false,
                },
                description: {
                  type: "string",
                  minLength: 10,
                  maxLength: 500,
                  description: "Detailed activity description",
                },
                tags: {
                  type: "array",
                  items: {
                    type: "string",
                    minLength: 2,
                  },
                  minItems: 2,
                  maxItems: 8,
                  description:
                    "Descriptive tags (e.g., ['museum', 'history', 'art'])",
                },
                bookingRequired: {
                  type: "boolean",
                  description: "Whether advance booking is required",
                },
                transportation: {
                  type: "object",
                  description:
                    "How to get to this activity from the previous location",
                  properties: {
                    method: {
                      type: "string",
                      enum: [
                        "walk",
                        "metro",
                        "bus",
                        "taxi",
                        "uber",
                        "tram",
                        "train",
                        "car",
                      ],
                      description: "Transportation method",
                    },
                    duration: {
                      type: "string",
                      description:
                        "Estimated duration (e.g., '10 minutes', '15 min')",
                    },
                    estimatedCost: {
                      type: "object",
                      properties: {
                        amount: {
                          type: "number",
                          minimum: 0,
                          description:
                            "Cost of transportation (0 if walking/free)",
                        },
                        currency: {
                          type: "string",
                          enum: ["USD", "EUR", "GBP", "JPY", "AUD", "CAD"],
                        },
                      },
                      required: ["amount", "currency"],
                      additionalProperties: false,
                    },
                    instructions: {
                      type: "string",
                      description:
                        "Brief instructions (e.g., 'Take Metro Line 1 to Louvre', 'Walk north on Main St')",
                    },
                  },
                  required: [
                    "method",
                    "duration",
                    "estimatedCost",
                    "instructions",
                  ],
                  additionalProperties: false,
                },
              },
              required: [
                "title",
                "startTime",
                "endTime",
                "category",
                "location",
                "cost",
                "description",
                "tags",
                "bookingRequired",
                "transportation",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["dayNumber", "date", "title", "activities"],
        additionalProperties: false,
      },
    },
  },
  required: ["days"],
  additionalProperties: false,
} as const;

/**
 * TypeScript interface matching the JSON schema
 */
export interface StrictItineraryResponse {
  days: Array<{
    dayNumber: number;
    date: string;
    title: string;
    activities: Array<{
      title: string;
      startTime: string;
      endTime: string;
      category:
        | "sightseeing"
        | "dining"
        | "cultural"
        | "shopping"
        | "relaxation"
        | "transport"
        | "accommodation"
        | "activity";
      location: {
        name: string;
        address: string;
      };
      cost: {
        amount: number;
        currency: "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD";
      };
      description: string;
      tags: string[];
      bookingRequired: boolean;
      transportation: {
        method:
          | "walk"
          | "metro"
          | "bus"
          | "taxi"
          | "uber"
          | "tram"
          | "train"
          | "car";
        duration: string;
        estimatedCost: {
          amount: number;
          currency: "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD";
        };
        instructions: string;
      };
    }>;
    metadata?: {
      theme?: string;
      totalEstimatedCost?: number;
      totalWalkingDistance?: string;
      mealsIncluded?: number;
      pacingLevel?: "relaxed" | "moderate" | "packed";
    };
  }>;
}

/**
 * Validation function to check if response matches schema
 */
export function validateItineraryResponse(
  data: unknown,
): data is StrictItineraryResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Response must be an object");
  }

  const response = data as Record<string, unknown>;

  if (!Array.isArray(response.days)) {
    throw new Error('Response must have "days" array');
  }

  for (const [index, day] of response.days.entries()) {
    if (typeof day !== "object" || !day) {
      throw new Error(`Day ${index} must be an object`);
    }

    const dayObj = day as Record<string, unknown>;

    // Check required day fields
    if (typeof dayObj.dayNumber !== "number") {
      throw new Error(`Day ${index}: dayNumber must be a number`);
    }

    if (
      typeof dayObj.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dayObj.date)
    ) {
      throw new Error(`Day ${index}: date must be in YYYY-MM-DD format`);
    }

    if (typeof dayObj.title !== "string" || dayObj.title.length < 3) {
      throw new Error(
        `Day ${index}: title must be a string with at least 3 characters`,
      );
    }

    if (!Array.isArray(dayObj.activities) || dayObj.activities.length === 0) {
      throw new Error(`Day ${index}: activities must be a non-empty array`);
    }

    // Check each activity
    for (const [actIndex, activity] of dayObj.activities.entries()) {
      if (typeof activity !== "object" || !activity) {
        throw new Error(
          `Day ${index}, Activity ${actIndex}: must be an object`,
        );
      }

      const act = activity as Record<string, unknown>;

      // Check location structure
      if (typeof act.location !== "object" || !act.location) {
        throw new Error(
          `Day ${index}, Activity ${actIndex}: location must be an object`,
        );
      }

      const loc = act.location as Record<string, unknown>;
      if (typeof loc.name !== "string" || loc.name.length < 2) {
        throw new Error(
          `Day ${index}, Activity ${actIndex}: location.name required`,
        );
      }

      if (typeof loc.address !== "string" || loc.address.length < 10) {
        throw new Error(
          `Day ${index}, Activity ${actIndex}: location.address must be a full address`,
        );
      }

      // Check cost structure
      if (typeof act.cost !== "object" || !act.cost) {
        throw new Error(
          `Day ${index}, Activity ${actIndex}: cost must be an object`,
        );
      }

      const cost = act.cost as Record<string, unknown>;
      if (typeof cost.amount !== "number" || cost.amount < 0) {
        throw new Error(
          `Day ${index}, Activity ${actIndex}: cost.amount must be a non-negative number (use 0 for free)`,
        );
      }

      if (typeof cost.currency !== "string") {
        throw new Error(
          `Day ${index}, Activity ${actIndex}: cost.currency required`,
        );
      }

      // Check tags
      if (!Array.isArray(act.tags) || act.tags.length < 2) {
        throw new Error(
          `Day ${index}, Activity ${actIndex}: tags must have at least 2 elements`,
        );
      }

      // Check bookingRequired
      if (typeof act.bookingRequired !== "boolean") {
        throw new Error(
          `Day ${index}, Activity ${actIndex}: bookingRequired must be boolean`,
        );
      }
    }
  }

  return true;
}
