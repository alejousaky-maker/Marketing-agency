import { economicsSchema, scenarioSchema, type Economics, type Assumptions } from './domain';
const divide = (a:number,b:number) => b > 0 ? a/b : null;

/** No intermediate rounding. Rates are fractions. All costs are per original order. */
export function unitEconomics(raw:Economics) {
  const e=economicsSchema.parse(raw);
  const collectedRevenue=e.aov*(1-e.discountRate);
  const netRevenue=collectedRevenue*(1-e.refundRate);
  const paymentFees=collectedRevenue*e.paymentFeeRate+e.paymentFeeFixed;
  const variableCosts=e.cogs+e.shipping+e.fulfillment+paymentFees;
  const contributionMargin=netRevenue-variableCosts;
  return {collectedRevenue,netRevenue,paymentFees,variableCosts,contributionMargin,
    contributionMarginPercent:divide(contributionMargin,netRevenue),
    breakEvenCpa:contributionMargin>0?contributionMargin:null,
    breakEvenRoas:contributionMargin>0?divide(netRevenue,contributionMargin):null};
}
export function actualMetrics(a:{adSpend:number;marketingSpend:number;orders:number;newCustomers:number;netRevenue:number;totalNetRevenue?:number;contributionBeforeAds:number}) {
  if(Object.values(a).some(v=>!Number.isFinite(v)||v<0)) throw new Error('Metrics must be finite and nonnegative');
  if(a.newCustomers>a.orders) throw new Error('New customers cannot exceed orders');
  return {cac:divide(a.adSpend,a.orders),newCustomerCac:divide(a.adSpend,a.newCustomers),roas:divide(a.netRevenue,a.adSpend),
    mer:a.totalNetRevenue==null?null:divide(a.totalNetRevenue,a.marketingSpend),profitRoas:divide(a.contributionBeforeAds-a.adSpend,a.adSpend),
    contributionProfitAfterAds:a.contributionBeforeAds-a.adSpend,firstOrderProfitability:divide(a.contributionBeforeAds-a.adSpend,a.orders)};
}
export function forecast(e:Economics,raw:Assumptions) {
  const a=scenarioSchema.parse(raw); const unit=unitEconomics(e);
  const impressions=a.budget/a.cpm*1000;
  const clicks=impressions*a.ctr;
  const potentialPurchases=clicks*a.cvr;
  const purchases=e.capacity==null?potentialPurchases:Math.min(potentialPurchases,e.capacity);
  const revenue=purchases*unit.netRevenue;
  const contributionBeforeAds=purchases*unit.contributionMargin;
  return {budget:a.budget,impressions,clicks,purchases,potentialPurchases,capacityLimited:purchases<potentialPurchases,
    cpc:divide(a.budget,clicks),cpa:divide(a.budget,purchases),revenue,roas:divide(revenue,a.budget),
    contributionBeforeAds,adSpend:a.budget,contributionAfterAds:contributionBeforeAds-a.budget,assumptions:a};
}
export function scenarios(e:Economics,a:Assumptions) {
  // Explicit stress assumptions, not calibrated probability intervals.
  return {downside:forecast(e,{...a,cpm:a.cpm*1.25,ctr:a.ctr*.75,cvr:a.cvr*.7}),
    base:forecast(e,a),upside:forecast(e,{...a,cpm:a.cpm*.85,ctr:Math.min(1,a.ctr*1.2),cvr:Math.min(1,a.cvr*1.25)})};
}
export function sensitivity(e:Economics,a:Assumptions) {
  const baseline=forecast(e,a).contributionAfterAds;
  const unit=unitEconomics(e);
  const specs = ['CTR','CVR','CPM','AOV','Refund rate','Contribution margin'] as const;
  return specs.map(name=>{
    const at=(mult:number)=>{
      if(name==='Contribution margin')return forecast(e,a).purchases*unit.contributionMargin*mult-a.budget;
      const aa={...a},ee={...e};
      if(name==='CTR') aa.ctr=Math.min(1,a.ctr*mult);
      if(name==='CVR') aa.cvr=Math.min(1,a.cvr*mult);
      if(name==='CPM') aa.cpm=a.cpm*mult;
      if(name==='AOV') ee.aov=e.aov*mult;
      if(name==='Refund rate') ee.refundRate=Math.min(1,e.refundRate*mult);
      return forecast(ee,aa).contributionAfterAds;
    };
    const low=at(.8),high=at(1.2);
    return {name,low,base:baseline,high,impact:Math.max(Math.abs(low-baseline),Math.abs(high-baseline)),change:'±20% relative, other inputs fixed'};
  }).sort((a,b)=>b.impact-a.impact);
}
export type Decision = 'DO NOT RUN'|'REVISE BEFORE TEST'|'SMALL TEST'|'STRONG TEST CANDIDATE'|'SCALE EXISTING WINNER';
export function decide(input:{economics:Economics|null;assumptions:Assumptions|null;score:number|null;coverage:number;simulated:boolean;verifiedWinner?:{purchases:number;profit:number;replications:number};criticalIssues?:string[]}) : {label:Decision;reasons:string[];confidence:'LOW'|'MEDIUM'|'HIGH'} {
  const {economics:e,assumptions:a}=input;
  if(!e||!a)return {label:'REVISE BEFORE TEST',reasons:['Complete unit economics and sourced CPM, CTR and CVR assumptions before committing budget.'],confidence:'LOW'};
  const unit=unitEconomics(e);const s=scenarios(e,a);
  if(unit.contributionMargin<=0)return {label:'DO NOT RUN',reasons:['Every order loses contribution profit before advertising. Fix price or variable costs first.'],confidence:'HIGH'};
  if(s.upside.contributionAfterAds<0)return {label:'DO NOT RUN',reasons:['Even the upside scenario loses contribution profit after ads.'],confidence:'MEDIUM'};
  if(input.criticalIssues?.length || input.score===null || input.score<50 || input.coverage<.5)
    return {label:'REVISE BEFORE TEST',reasons:input.criticalIssues?.length?input.criticalIssues:['Creative evidence or quality is insufficient; resolve the weak elements before testing.'],confidence:'LOW'};
  const w=input.verifiedWinner;
  if(!input.simulated&&w&&w.purchases>=100&&w.replications>=2&&w.profit>0&&s.downside.contributionAfterAds>0)
    return {label:'SCALE EXISTING WINNER',reasons:['Verified first-order profit across replicated experiments supports a controlled budget increase.'],confidence:'MEDIUM'};
  if(!input.simulated&&(a.sampleSize??0)>=100&&input.score>=75&&s.downside.contributionAfterAds>0)
    return {label:'STRONG TEST CANDIDATE',reasons:['Positive stressed contribution profit, sufficient historical sample and strong creative evidence support a controlled test.'],confidence:'MEDIUM'};
  return {label:'SMALL TEST',reasons:[s.base.contributionAfterAds>0?'Base-case economics support a capped learning test.':'Only optimistic assumptions are profitable; use a small learning budget.',input.simulated?'Simulated evidence cannot justify spending or scaling.':'Forecasts are hypotheses; validate conversion quality and refund-adjusted profit.'],confidence:'LOW'};
}
/** Two-sided 5% alpha, 80% power normal approximation; purchases are not impressions. */
export function minimumSample(baseCvr:number,relativeLift=.3) {
  if(baseCvr<=0||baseCvr>=1||relativeLift<=0)return null;
  const treatment=Math.min(.999,baseCvr*(1+relativeLift));
  const p=(baseCvr+treatment)/2,d=treatment-baseCvr;
  return Math.ceil(2*(1.96+.84)**2*p*(1-p)/(d*d));
}
