import { describe,it,expect } from 'vitest';
import { economics,assumptions } from './fixtures';
import { unitEconomics,actualMetrics,forecast,scenarios,sensitivity,decide,minimumSample } from '../src/lib/finance';
describe('deterministic per-order financial formulas',()=>{
  const unit=unitEconomics(economics);
  it.each([['collectedRevenue',90],['netRevenue',81],['paymentFees',3],['variableCosts',37],['contributionMargin',44],['contributionMarginPercent',44/81],['breakEvenCpa',44],['breakEvenRoas',81/44]] as const)('%s', (key,value)=>expect(unit[key]).toBeCloseTo(value,9));
  it('does not recover fees or COGS on refunds',()=>expect(unitEconomics({...economics,refundRate:1}).contributionMargin).toBe(-37));
  it('does not invent viable break-even economics for negative margins',()=>{const x=unitEconomics({...economics,cogs:200});expect(x.breakEvenCpa).toBeNull();expect(x.breakEvenRoas).toBeNull();});
  it('leaves zero net-revenue percentage undefined',()=>expect(unitEconomics({...economics,discountRate:1}).contributionMarginPercent).toBeNull());
  it('rejects missing required financial inputs',()=>expect(()=>unitEconomics({...economics,cogs:undefined!})).toThrow());
  it.each([-1,1.1,NaN,Infinity])('rejects invalid rate %s',n=>expect(()=>unitEconomics({...economics,refundRate:n})).toThrow());
  it('retains precision until presentation',()=>{const x=unitEconomics({...economics,aov:19.99,refundRate:.031,discountRate:.073});expect(x.netRevenue).toBeCloseTo(19.99*.927*.969,12);});
});
describe('attributed actual financial metrics',()=>{
  const m=actualMetrics({adSpend:500,marketingSpend:1000,orders:50,newCustomers:25,netRevenue:5000,totalNetRevenue:6000,contributionBeforeAds:2000});
  it.each([['cac',10],['newCustomerCac',20],['roas',10],['mer',6],['profitRoas',3],['contributionProfitAfterAds',1500],['firstOrderProfitability',30]] as const)('%s', (key,value)=>expect(m[key]).toBe(value));
  it('does not substitute attributed revenue for total business revenue',()=>expect(actualMetrics({adSpend:500,marketingSpend:1000,orders:50,newCustomers:25,netRevenue:5000,contributionBeforeAds:2000}).mer).toBeNull());
  it('returns unknown ratios for zero denominators',()=>{const x=actualMetrics({adSpend:0,marketingSpend:0,orders:0,newCustomers:0,netRevenue:0,contributionBeforeAds:0});expect(x.cac).toBeNull();expect(x.newCustomerCac).toBeNull();expect(x.roas).toBeNull();expect(x.mer).toBeNull();expect(x.profitRoas).toBeNull();});
  it('rejects impossible new-customer counts',()=>expect(()=>actualMetrics({adSpend:10,marketingSpend:10,orders:2,newCustomers:3,netRevenue:2,contributionBeforeAds:1})).toThrow());
});
describe('forecast and sensitivity',()=>{
  const f=forecast(economics,assumptions);
  it.each([['impressions',100000],['clicks',2000],['purchases',80],['cpc',.5],['cpa',12.5],['revenue',6480],['roas',6.48],['contributionBeforeAds',3520],['adSpend',1000],['contributionAfterAds',2520]] as const)('%s',(key,value)=>expect(f[key]).toBeCloseTo(value,9));
  it('caps fulfilled purchases without reducing spend',()=>{const x=forecast({...economics,capacity:20},assumptions);expect(x.purchases).toBe(20);expect(x.potentialPurchases).toBe(80);expect(x.capacityLimited).toBe(true);expect(x.adSpend).toBe(1000);expect(x.cpa).toBe(50);});
  it('models zero conversions as a full loss with undefined CPA',()=>{const x=forecast(economics,{...assumptions,cvr:0});expect(x.cpa).toBeNull();expect(x.contributionAfterAds).toBe(-1000);});
  it('rejects a zero CPM',()=>expect(()=>forecast(economics,{...assumptions,cpm:0})).toThrow());
  it('rejects tiny CPM values that would overflow financial projections',()=>expect(()=>forecast(economics,{...assumptions,cpm:1e-300})).toThrow());
  it('orders all three stress scenarios',()=>{const s=scenarios(economics,assumptions);expect(s.downside.contributionAfterAds).toBeLessThan(s.base.contributionAfterAds);expect(s.upside.contributionAfterAds).toBeGreaterThan(s.base.contributionAfterAds);});
  it('clamps optimistic conversion rates',()=>expect(scenarios(economics,{...assumptions,ctr:.9,cvr:.9}).upside.assumptions.cvr).toBe(1));
  it('calculates all six sensitivity dimensions',()=>expect(sensitivity(economics,assumptions).map(s=>s.name).sort()).toEqual(['AOV','CPM','CTR','CVR','Contribution margin','Refund rate']));
  it('higher CPM and refund rate reduce profit',()=>{const s=sensitivity(economics,assumptions);for(const key of ['CPM','Refund rate']){const row=s.find(r=>r.name===key)!;expect(row.high).toBeLessThan(row.base);expect(row.low).toBeGreaterThan(row.base);}});
  it('sorts the largest leverage first',()=>{const s=sensitivity(economics,assumptions);expect(s[0].impact).toBe(Math.max(...s.map(x=>x.impact)));});
  it('requires a meaningful per-arm experiment sample',()=>{expect(minimumSample(.04)).toBeGreaterThan(4000);expect(minimumSample(0)).toBeNull();expect(minimumSample(1)).toBeNull();});
});
describe('conservative recommendation gates',()=>{
  const input={economics,assumptions,score:85,coverage:1,simulated:false};
  it('requires financial inputs',()=>expect(decide({...input,economics:null}).label).toBe('REVISE BEFORE TEST'));
  it('stops negative unit economics',()=>expect(decide({...input,economics:{...economics,cogs:200}}).label).toBe('DO NOT RUN'));
  it('stops when even upside loses',()=>expect(decide({...input,assumptions:{...assumptions,cpm:200}}).label).toBe('DO NOT RUN'));
  it('requires creative evidence coverage',()=>expect(decide({...input,coverage:.1}).label).toBe('REVISE BEFORE TEST'));
  it('requires revisions for weak creative',()=>expect(decide({...input,score:30}).label).toBe('REVISE BEFORE TEST'));
  it('supports a strong controlled test with robust inputs',()=>expect(decide(input).label).toBe('STRONG TEST CANDIDATE'));
  it('never scales a simulation',()=>expect(decide({...input,simulated:true,verifiedWinner:{purchases:1000,profit:5000,replications:3}}).label).toBe('SMALL TEST'));
  it('does not scale a tiny sample',()=>expect(decide({...input,verifiedWinner:{purchases:5,profit:500,replications:2}}).label).not.toBe('SCALE EXISTING WINNER'));
  it('requires replicated measured profit before scaling',()=>expect(decide({...input,verifiedWinner:{purchases:200,profit:500,replications:2}}).label).toBe('SCALE EXISTING WINNER'));
});
