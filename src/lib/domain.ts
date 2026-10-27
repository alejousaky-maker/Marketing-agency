import { z } from 'zod';

export const rate = z.number().finite().min(0).max(1);
export const money = z.number().finite().min(0).max(1e9);
export const economicsSchema = z.object({
  aov: money.min(.01), cogs: money, shipping: money, fulfillment: money,
  paymentFeeRate: rate, paymentFeeFixed: money, refundRate: rate, discountRate: rate,
  targetCac: money.nullable(), capacity: z.number().int().positive().nullable(),
  historicalCpm: money.min(.01).nullable(), historicalCtr: rate.nullable(), historicalCvr: rate.nullable(),
  historicalCac: money.nullable(), historicalRoas: money.nullable(),
  sampleSize: z.number().int().nonnegative().nullable(),
});
export type Economics = z.infer<typeof economicsSchema>;
export const clientSchema = z.object({
  name: z.string().trim().min(2).max(100), industry: z.string().trim().min(2).max(100),
  website: z.union([z.literal(''), z.url().refine(v=>['https:','http:'].includes(new URL(v).protocol),'Use an HTTP or HTTPS website.')]).default(''), geography: z.string().trim().min(2).max(100),
  currency: z.enum(['USD','GBP','EUR','CAD','AUD']).default('USD'),
  audience: z.string().max(1000).default(''), productName: z.string().min(2).max(150),
  price: money.positive(), offer: z.string().max(1000).default(''),
  economics: economicsSchema.nullable(),
});
export const scenarioSchema = z.object({
  budget: money.min(.01), cpm: money.min(.01), ctr: rate, cvr: rate,
  source: z.string().min(3).max(500), sampleSize: z.number().int().nonnegative().nullable(),
});
export type Assumptions = z.infer<typeof scenarioSchema>;
export type Provenance = 'observed' | 'estimated' | 'simulated';
export type Evidence = { id: string; title: string; url: string; excerpt: string; fetchedAt: string; provenance: Provenance; kind: string };
export const scorecardKeys = [
  'hook01','hook02','hook03','patternInterrupt','spokenHook','textHook','audienceClarity',
  'problemClarity','valueProposition','productClarity','demonstration','proof','specificity',
  'authenticity','nativeFeeling','pacing','captionReadability','branding','offer','riskReversal',
  'urgency','cta','landingPageCongruence','platformFit',
] as const;
export const scoreLabels: Record<typeof scorecardKeys[number],string> = {
  hook01:'Hook · first second',hook02:'Hook · first 2 seconds',hook03:'Hook · first 3 seconds',
  patternInterrupt:'Visual pattern interrupt',spokenHook:'Spoken hook',textHook:'Text hook',
  audienceClarity:'Audience clarity',problemClarity:'Problem clarity',valueProposition:'Value proposition',
  productClarity:'Product clarity',demonstration:'Demonstration',proof:'Social proof',specificity:'Specificity',
  authenticity:'Authenticity',nativeFeeling:'Native / UGC feel',pacing:'Pacing',captionReadability:'Caption readability',
  branding:'Branding',offer:'Offer strength',riskReversal:'Risk reversal',urgency:'Urgency',cta:'Call to action',
  landingPageCongruence:'Landing page congruence',platformFit:'Platform fit',
};
export const semanticSchema = z.object({
  summary: z.string(), product: z.string(), audience: z.string(), painPoint: z.string(), offer: z.string(),
  claims: z.array(z.string()), cta: z.string(), socialProof: z.string(), objections: z.array(z.string()),
  strengths: z.array(z.string()).min(1), weaknesses: z.array(z.string()).min(1),
  timeline: z.array(z.object({ start: z.number().nonnegative(), end: z.number().positive(),
    stage: z.enum(['HOOK','PROBLEM','AGITATION','SOLUTION','MECHANISM','DEMONSTRATION','PROOF','OFFER','CTA']),
    description: z.string() })),
  scorecard: z.array(z.object({ key: z.enum(scorecardKeys), score: z.number().min(0).max(100).nullable(), reasoning: z.string(), evidence: z.string() })),
  fingerprint: z.object({ hookType:z.string(),emotion:z.string(),humanPresence:z.boolean().nullable(),founderPresence:z.boolean().nullable(),customerPresence:z.boolean().nullable(),productAppearanceTime:z.number().nonnegative().nullable(),demonstration:z.boolean().nullable(),testimonial:z.boolean().nullable(),priceMention:z.boolean().nullable(),proof:z.string(),ctaType:z.string(),offerType:z.string() }),
  variants: z.array(z.object({ name:z.string(),variable:z.string(),instruction:z.string(),hypothesis:z.string() })).min(1),
  platforms: z.array(z.object({ name:z.string(),reason:z.string() })).min(1),
});
export type SemanticAnalysis = z.infer<typeof semanticSchema>;
export type VideoMetadata = { duration:number; width:number; height:number; aspectRatio:string; frameRate:number; hasAudio:boolean; scenes:number[]; format:string };
export type VideoResult = { metadata:VideoMetadata; frames:{key:string;time:number;text:string}[]; audioKey:string|null; transcript:string|null; transcriptSource:string; warnings:string[] };

export class AppError extends Error {
  constructor(public status:number, message:string) { super(message); }
}
