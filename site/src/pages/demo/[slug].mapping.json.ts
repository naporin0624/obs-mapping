import type { APIRoute, GetStaticPaths } from 'astro';
import { DEMO_SLUGS, mappings } from '../../demos';
import type { DemoSlug } from '../../scene/spec';
import { serializeMapping } from '../../scene/serialize';

export const getStaticPaths = (() => DEMO_SLUGS.map((slug) => ({ params: { slug }, props: { slug } }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ slug: DemoSlug }> = ({ props }) => new Response(serializeMapping(mappings[props.slug]), { headers: { 'Content-Type': 'application/json' } });
