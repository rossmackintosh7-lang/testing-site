export function buttonActionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", enum: ["enquiry_form", "booking_link", "phone_call", "email", "internal_page"] },
      target: { type: "string" },
      explanation: { type: "string" }
    },
    required: ["type", "target", "explanation"]
  };
}

export function websiteDraftSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      brand: {
        type: "object",
        additionalProperties: false,
        properties: {
          businessName: { type: "string" },
          tone: { type: "string" },
          location: { type: "string" },
          audience: { type: "string" },
          colourSuggestion: { type: "string" },
          fontSuggestion: { type: "string" }
        },
        required: ["businessName", "tone", "location", "audience", "colourSuggestion", "fontSuggestion"]
      },
      pages: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            slug: { type: "string" },
            title: { type: "string" },
            navLabel: { type: "string" },
            purpose: { type: "string" }
          },
          required: ["slug", "title", "navLabel", "purpose"]
        }
      },
      home: {
        type: "object",
        additionalProperties: false,
        properties: {
          heroTitle: { type: "string" },
          heroSubtitle: { type: "string" },
          primaryButtonText: { type: "string" },
          secondaryButtonText: { type: "string" },
          primaryButtonAction: buttonActionSchema(),
          trustBullets: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } }
        },
        required: ["heroTitle", "heroSubtitle", "primaryButtonText", "secondaryButtonText", "primaryButtonAction", "trustBullets"]
      },
      about: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string" },
          summary: { type: "string" },
          shortVersion: { type: "string" }
        },
        required: ["heading", "summary", "shortVersion"]
      },
      services: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            idealFor: { type: "string" },
            callToAction: { type: "string" }
          },
          required: ["title", "description", "idealFor", "callToAction"]
        }
      },
      faq: {
        type: "array",
        minItems: 4,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: { question: { type: "string" }, answer: { type: "string" } },
          required: ["question", "answer"]
        }
      },
      seo: {
        type: "object",
        additionalProperties: false,
        properties: {
          pageTitle: { type: "string" },
          metaDescription: { type: "string" },
          h1: { type: "string" },
          suggestedKeywords: { type: "array", minItems: 5, maxItems: 12, items: { type: "string" } },
          localSeoNotes: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } }
        },
        required: ["pageTitle", "metaDescription", "h1", "suggestedKeywords", "localSeoNotes"]
      },
      launchChecklist: {
        type: "array",
        minItems: 6,
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            task: { type: "string" },
            reason: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] }
          },
          required: ["task", "reason", "priority"]
        }
      },
      customBuildPrompt: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string" },
          text: { type: "string" },
          buttonText: { type: "string" },
          recommendedFor: { type: "string" }
        },
        required: ["heading", "text", "buttonText", "recommendedFor"]
      },
      assistedSetupPrompt: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string" },
          text: { type: "string" },
          buttonText: { type: "string" },
          recommendedTasks: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } }
        },
        required: ["heading", "text", "buttonText", "recommendedTasks"]
      }
    },
    required: ["brand", "pages", "home", "about", "services", "faq", "seo", "launchChecklist", "customBuildPrompt", "assistedSetupPrompt"]
  };
}

export function sectionImprovementSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      sectionKey: { type: "string" },
      improvedContent: { type: "string" },
      reason: { type: "string" },
      suggestedButtonText: { type: "string" },
      warning: { type: "string" }
    },
    required: ["sectionKey", "improvedContent", "reason", "suggestedButtonText", "warning"]
  };
}

export function seoPlanSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      pageTitle: { type: "string" },
      metaDescription: { type: "string" },
      h1: { type: "string" },
      h2Ideas: { type: "array", items: { type: "string" } },
      keywords: { type: "array", items: { type: "string" } },
      localSeoActions: { type: "array", items: { type: "string" } },
      contentIdeas: { type: "array", items: { type: "string" } },
      warnings: { type: "array", items: { type: "string" } }
    },
    required: ["pageTitle", "metaDescription", "h1", "h2Ideas", "keywords", "localSeoActions", "contentIdeas", "warnings"]
  };
}
