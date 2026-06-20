using System.Text.Json.Nodes;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;
using Microsoft.OpenApi.Reader;

namespace WMess.Web.Infrastructure;

public class ApiProxyDocumentTransformer : IOpenApiDocumentTransformer
{
    private const string SchemaRefPrefix = "#/components/schemas/";

    private readonly IWebHostEnvironment _environment;

    public ApiProxyDocumentTransformer(IWebHostEnvironment environment)
    {
        _environment = environment;
    }

    public async Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken cancellationToken)
    {
        var apiDocumentPath = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, "..", "WMess.Api", "WMess.Api.json"));
        if (!File.Exists(apiDocumentPath))
        {
            return;
        }

        var apiJson = await File.ReadAllTextAsync(apiDocumentPath, cancellationToken);
        var bffJson = await document.SerializeAsJsonAsync(OpenApiSpecVersion.OpenApi3_1, cancellationToken);

        var mergedJson = Merge(bffJson, apiJson);

        var merged = OpenApiDocument.Parse(mergedJson, "json", new OpenApiReaderSettings()).Document;
        if (merged is null)
        {
            return;
        }

        document.Paths = merged.Paths;
        document.Components = merged.Components;
        document.Tags = merged.Tags;
    }

    private static string Merge(string bffJson, string apiJson)
    {
        var bff = JsonNode.Parse(bffJson)!.AsObject();
        var api = JsonNode.Parse(apiJson)!.AsObject();

        var bffComponents = bff["components"]?.AsObject() ?? new JsonObject();
        var bffSchemas = bffComponents["schemas"]?.AsObject() ?? new JsonObject();
        var apiSchemas = api["components"]?["schemas"]?.AsObject() ?? new JsonObject();

        var proxiedPaths = new JsonObject();
        var apiPaths = api["paths"]?.AsObject();
        if (apiPaths is not null)
        {
            foreach (var (path, item) in apiPaths.ToList())
            {
                if (path.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var clonedItem = item!.DeepClone().AsObject();
                foreach (var operation in clonedItem)
                {
                    (operation.Value as JsonObject)?.Remove("security");
                }

                proxiedPaths[path] = clonedItem;
            }
        }

        var referenced = CollectReachableSchemas(proxiedPaths, apiSchemas);

        var renames = new Dictionary<string, string>();
        foreach (var name in bffSchemas.Select(kvp => kvp.Key).ToList())
        {
            if (referenced.Contains(name))
            {
                renames[name] = "Bff" + name;
            }
        }

        if (renames.Count > 0)
        {
            RewriteSchemaRefs(bff, renames);
        }

        var schemas = new JsonObject();
        foreach (var (name, schema) in bffSchemas.ToList())
        {
            schemas[renames.TryGetValue(name, out var renamed) ? renamed : name] = schema!.DeepClone();
        }

        foreach (var name in referenced)
        {
            schemas[name] = apiSchemas[name]!.DeepClone();
        }

        var paths = bff["paths"]?.AsObject() ?? new JsonObject();
        foreach (var (path, item) in proxiedPaths.ToList())
        {
            paths[path] = item!.DeepClone();
        }

        bffComponents["schemas"] = schemas;
        bffComponents.Remove("securitySchemes");
        bff["components"] = bffComponents;
        bff["paths"] = paths;
        bff.Remove("security");

        return bff.ToJsonString();
    }

    private static HashSet<string> CollectReachableSchemas(JsonObject proxiedPaths, JsonObject apiSchemas)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        var queue = new Queue<string>();

        var seed = new List<string>();
        AddSchemaRefs(proxiedPaths, seed);
        foreach (var name in seed)
        {
            if (apiSchemas.ContainsKey(name) && result.Add(name))
            {
                queue.Enqueue(name);
            }
        }

        while (queue.Count > 0)
        {
            var refs = new List<string>();
            AddSchemaRefs(apiSchemas[queue.Dequeue()], refs);
            foreach (var name in refs)
            {
                if (apiSchemas.ContainsKey(name) && result.Add(name))
                {
                    queue.Enqueue(name);
                }
            }
        }

        return result;
    }

    private static void AddSchemaRefs(JsonNode? node, ICollection<string> into)
    {
        switch (node)
        {
            case JsonObject obj:
                foreach (var (key, value) in obj)
                {
                    if (key == "$ref"
                        && value is JsonValue reference
                        && reference.TryGetValue<string>(out var refValue)
                        && refValue.StartsWith(SchemaRefPrefix, StringComparison.Ordinal))
                    {
                        into.Add(refValue[SchemaRefPrefix.Length..]);
                    }
                    else
                    {
                        AddSchemaRefs(value, into);
                    }
                }

                break;
            case JsonArray array:
                foreach (var item in array)
                {
                    AddSchemaRefs(item, into);
                }

                break;
        }
    }

    private static void RewriteSchemaRefs(JsonNode? node, Dictionary<string, string> renames)
    {
        switch (node)
        {
            case JsonObject obj:
                foreach (var (key, value) in obj.ToList())
                {
                    if (key == "$ref"
                        && value is JsonValue reference
                        && reference.TryGetValue<string>(out var refValue)
                        && refValue.StartsWith(SchemaRefPrefix, StringComparison.Ordinal)
                        && renames.TryGetValue(refValue[SchemaRefPrefix.Length..], out var renamed))
                    {
                        obj[key] = SchemaRefPrefix + renamed;
                    }
                    else
                    {
                        RewriteSchemaRefs(value, renames);
                    }
                }

                break;
            case JsonArray array:
                foreach (var item in array)
                {
                    RewriteSchemaRefs(item, renames);
                }

                break;
        }
    }
}
