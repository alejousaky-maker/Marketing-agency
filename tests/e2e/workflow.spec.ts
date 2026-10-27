import { test,expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
test('dry run: login, review full analysis, research, economics, experiment and report',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/login');await page.getByRole('button',{name:'Explore demo workspace'}).click();
  await expect(page.getByRole('heading',{name:'A little clarity. A lot of possibility.'})).toBeVisible();
  await page.screenshot({path:'.data/qa-overview-desktop.png',fullPage:true});
  await page.getByRole('link',{name:'Creative library',exact:true}).click();
  await page.getByLabel('Selected client').selectOption({label:'Terra Rituals · Demo'});
  await page.getByRole('button').filter({has:page.getByRole('heading',{name:'Terra — The Daily Ritual.mp4'})}).first().click();
  await expect(page.getByRole('heading',{name:'Your creative. A clearer direction.'})).toBeVisible();
  await expect(page.getByText('SIMULATED DRY RUN',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Small Test',exact:true})).toBeVisible();
  await expect(page.getByText('Break-even CPA',{exact:true})).toBeVisible();
  await page.screenshot({path:'.data/qa-analysis-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Scorecard',exact:true}).click();await expect(page.getByText('Landing page congruence',{exact:true})).toBeVisible();await expect(page.locator('.score-item')).toHaveCount(24);
  await page.getByRole('button',{name:'Timeline',exact:true}).click();await expect(page.locator('.keyframes img')).not.toHaveCount(0);await expect(page.getByText('Creative structure',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Profit forecast',exact:true}).click();await expect(page.getByRole('cell',{name:'Contribution after ads',exact:true})).toBeVisible();await expect(page.getByText('Where the leverage is',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Creative variants',exact:true}).click();await expect(page.getByText('The 10-second cut',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Sources',exact:true}).click();await expect(page.getByText('Category positioning brief',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Fingerprint',exact:true}).click();await expect(page.getByText('Creative fingerprint',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Create experiment',exact:true}).click();await expect(page.getByRole('heading',{name:'Lead with the payoff'}).first()).toBeVisible();
  await page.getByRole('link',{name:'Market intelligence',exact:true}).click();await expect(page.getByRole('heading',{name:'The evidence desk'})).toBeVisible();
  await page.getByRole('link',{name:'Competitors',exact:true}).click();await expect(page.getByRole('heading',{name:'Sunday Studio'})).toBeVisible();
  await page.getByRole('link',{name:'Gap analysis',exact:true}).click();await expect(page.getByRole('heading',{name:'Make proof tangible'})).toBeVisible();
  await page.getByRole('link',{name:'Trend radar',exact:true}).click();await expect(page.getByRole('heading',{name:'Relevance beats reach.'})).toBeVisible();
  await page.getByRole('link',{name:'Profitability',exact:true}).click();await page.getByLabel('Budget',{exact:true}).fill('750');await page.getByRole('button',{name:'Save scenario',exact:true}).click();await expect(page.getByText('Scenario saved to your client’s forecast history.')).toBeVisible();
  await page.getByRole('link',{name:'Reports',exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'JSON',exact:true}).first().click();expect((await downloadPromise).suggestedFilename()).toMatch(/^agencyos-.*\.json$/);
  await page.getByRole('link',{name:'Integrations',exact:true}).click();await expect(page.getByText('No advertising execution is enabled.',{exact:false})).toBeVisible();
  await page.getByRole('link',{name:'Settings',exact:true}).click();await expect(page.getByRole('heading',{name:'Workspace activity'})).toBeVisible();expect(errors).toEqual([]);
});

test('new agency: register, configure a real client, upload and process media, receive an honest decision',async({page})=>{
  await page.goto('/login');await page.getByRole('button',{name:'Create a workspace',exact:true}).click();
  await page.getByLabel('Your name').fill('Browser QA');await page.getByLabel('Agency name').fill('Browser QA '+Date.now());
  await page.getByLabel('Email address').fill(`browser-${Date.now()}@example.test`);await page.getByLabel('Password',{exact:true}).fill(randomBytes(16).toString('hex'));
  await page.getByRole('button',{name:'Create workspace',exact:true}).click();await expect(page.getByRole('heading',{name:'A little clarity. A lot of possibility.'})).toBeVisible();
  await page.getByRole('link',{name:'Clients',exact:true}).click();await page.getByRole('button',{name:'Add client',exact:true}).first().click();
  const fields:Record<string,string>={'Client name':'QA Everyday Co.','Industry':'Home & lifestyle','Primary geography':'United States','Primary product / service':'Starter Kit','Product price':'100','Average order value':'100','COGS per order':'25','Shipping per order':'5','Fulfillment per order':'4','Payment fee (%)':'3','Fixed payment fee':'0.3','Refund rate (%)':'10','Average discount (%)':'10','CPM':'10','CTR (%)':'2','Click → purchase CVR (%)':'4','Historical purchase sample':'200'};
  for(const [label,value]of Object.entries(fields))await page.getByRole('dialog').getByLabel(label,{exact:true}).fill(value);
  await page.getByRole('button',{name:'Create client',exact:true}).click();await expect(page.getByRole('heading',{name:'QA Everyday Co.',exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Analyze a creative',exact:true}).click();
  await page.getByLabel('Video file',{exact:true}).setInputFiles('.data/demo-ritual.mp4');await page.getByText('Add a transcript',{exact:false}).click();await page.getByPlaceholder('Paste the spoken words, if available. We retain this as user-provided evidence.').fill('Find your daily ritual. Explore the starter kit.');
  await page.getByRole('button',{name:'Analyze creative',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your creative. A clearer direction.'})).toBeVisible({timeout:60000});
  await expect(page.getByText('EVIDENCE + ESTIMATES',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Revise Before Test',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Scorecard',exact:true}).click();await expect(page.getByText('Provider: Local metadata + OCR.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Profit forecast',exact:true}).click();await expect(page.getByRole('cell',{name:'Contribution after ads',exact:true})).toBeVisible();
});

test('mobile layout remains usable with no horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/login');await page.getByRole('button',{name:'Explore demo workspace'}).click();await expect(page.getByRole('heading',{name:'A little clarity. A lot of possibility.'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'.data/qa-overview-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('link',{name:'Analyze creative',exact:true}).click();await expect(page.getByText('Drop your next breakthrough here.')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
