import type { Economics, Assumptions,VideoResult } from '../src/lib/domain';
import type { ClientContext } from '../src/lib/intelligence';
export const economics:Economics={aov:100,cogs:25,shipping:5,fulfillment:4,paymentFeeRate:.03,paymentFeeFixed:.3,refundRate:.1,discountRate:.1,targetCac:30,capacity:null,historicalCpm:10,historicalCtr:.02,historicalCvr:.04,historicalCac:12.5,historicalRoas:6.48,sampleSize:200};
export const assumptions:Assumptions={budget:1000,cpm:10,ctr:.02,cvr:.04,source:'Test fixture',sampleSize:200};
export const client:ClientContext={id:'00000000-0000-4000-8000-000000000001',name:'Test client',industry:'Home',audience:'Test audience',geography:'United States',website:'https://example.com',currency:'USD',simulated:false,economics,productName:'Test product',offer:'Starter kit'};
export const video:VideoResult={metadata:{duration:15,width:480,height:854,aspectRatio:'240:427',frameRate:24,hasAudio:false,scenes:[3,5,10],format:'mov,mp4'},frames:[{key:'test/frame.jpg',time:.8,text:'Find your daily ritual'}],audioKey:null,transcript:null,transcriptSource:'Unavailable',warnings:[]};
