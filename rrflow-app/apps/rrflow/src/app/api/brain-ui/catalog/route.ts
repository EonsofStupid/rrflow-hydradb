import { z } from 'zod';
import { BRAIN_UI_CATALOG, brainUiComponentSchema } from '@/lib/brain-ui-contracts';

// The negotiated catalog is intentionally limited to these native React components.
export const GET = () => {
  const component = z.toJSONSchema(brainUiComponentSchema) as Record<string, unknown> & { oneOf?: Array<{ properties: Record<string, unknown> }>; anyOf?: Array<{ properties: Record<string, unknown> }> };
  for (const variant of component.oneOf ?? component.anyOf ?? []) {
    variant.properties.id = { $ref: 'https://a2ui.org/specification/v0_9_1/common_types.json#/$defs/ComponentId' };
    if ('children' in variant.properties) variant.properties.children = { allOf: [{ $ref: 'https://a2ui.org/specification/v0_9_1/common_types.json#/$defs/ChildList' }, { type: 'array', maxItems: 80 }] };
  }
  return Response.json({
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: BRAIN_UI_CATALOG,
    title: 'RRFLOW brain workspace catalog',
    description: 'A2UI v0.9.1 custom catalog. Fixed root data-model binding and five native components; arbitrary code, functions and markup are unsupported.',
    $defs: { anyComponent: component, theme: { type: 'object', additionalProperties: false } },
  });
};
