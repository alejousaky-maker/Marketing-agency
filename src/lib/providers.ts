/** Future integrations are read-only boundaries. No campaign-execution interface exists. */
export type ProviderName='meta'|'tiktok'|'google-ads'|'shopify'|'ga4'|'crm';
export type ProviderContext={workspaceId:string;clientId:string;connectionId:string};
export type ProvenancedMetric={name:string;value:number;unit:string;source:string;observedAt:string;periodStart:string;periodEnd:string;sampleSize:number|null;attributionWindow:string|null};
export interface MarketingDataProvider {
  readonly name:ProviderName;
  readonly capabilities:readonly ('campaign-read'|'orders-read'|'analytics-read'|'customers-read')[];
  verifyConnection(context:ProviderContext):Promise<{connected:boolean;scopes:string[]}>;
  readMetrics(context:ProviderContext,period:{start:string;end:string}):Promise<ProvenancedMetric[]>;
}
export class UnconnectedProvider implements MarketingDataProvider {
  readonly capabilities=[] as const;
  constructor(readonly name:ProviderName){}
  async verifyConnection(){return {connected:false,scopes:[]};}
  async readMetrics():Promise<ProvenancedMetric[]>{throw new Error(`${this.name} is not connected. V1 does not invent provider metrics.`);}
}
