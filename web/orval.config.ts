import process from "node:process";
import { defineConfig } from "orval";
import type { OpenApiDocument } from "orval";

/**
 * NSwag emits multipart/form-data request bodies with `properties` but no
 * `type: "object"`, and file arrays with empty (`{}`) item schemas. Orval then
 * can't expand the fields and falls back to `formData.append("data", body)`,
 * which is invalid TypeScript. Patch those schemas so orval generates valid
 * per-field appends (and types file arrays as binary).
 */
type MultipartProp = {
  type?: string;
  items?: { type?: string; format?: string } | null;
};
type MultipartOperation = {
  requestBody?: {
    content?: Record<string, { schema?: { type?: string; properties?: Record<string, MultipartProp> } }>;
  };
};

function fixMultipartSchemas(spec: OpenApiDocument): OpenApiDocument {
  const paths = (spec.paths ?? {}) as unknown as Record<
    string,
    Record<string, MultipartOperation>
  >;
  for (const path of Object.values(paths)) {
    for (const operation of Object.values(path)) {
      const schema =
        operation?.requestBody?.content?.["multipart/form-data"]?.schema;
      if (!schema?.properties) continue;
      schema.type = "object";
      for (const prop of Object.values(schema.properties)) {
        if (prop?.type === "array" && (!prop.items || !prop.items.type)) {
          prop.items = { type: "string", format: "binary" };
        }
      }
    }
  }
  return spec;
}

/**
 * Generates the typed API client (react-query hooks + types) from the backend's
 * OpenAPI document. Run with `npm run generate:api`.
 *
 * The spec is served by NSwag in Development only, so the backend must be
 * running when generating. The target defaults to the local dev backend and is
 * overridable via `ORVAL_API_URL` for other machines / CI.
 */
export default defineConfig({
  stigvidd: {
    input: {
      target:
        process.env.ORVAL_API_URL ??
        "http://localhost:5265/swagger/v1/swagger.json",
      // NSwag emits the JWT `Bearer` scheme as `type: http` while also setting
      // `name`/`in` (only valid for `apiKey`), which trips strict validation.
      // Auth is handled in the mutator regardless, so skip validation.
      unsafeDisableValidation: true,
      override: { transformer: fixMultipartSchemas },
    },
    output: {
      mode: "tags-split", // one folder per controller/tag
      target: "src/api/generated",
      schemas: "src/api/generated/model",
      client: "react-query", // @tanstack/react-query — already a dependency
      httpClient: "fetch", // no axios in the project; use native fetch
      override: {
        mutator: { path: "src/api/mutator.ts", name: "customFetch" },
        // Hooks return the DTO directly instead of { data, status, headers }.
        fetch: { includeHttpResponseReturnType: false },
        query: { useQuery: true, useMutation: true },
      },
    },
  },
});
