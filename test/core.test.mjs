import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileStickyRoster, computeGridLayout, selectVisiblePanes } from '../lib/core.js'

test('finished sessions retain their roster position', () => {
  const sessions = [{id:'a',liveState:'waiting'}, {id:'b',liveState:'running'}]
  const {roster} = reconcileStickyRoster({sessions})
  const next = reconcileStickyRoster({sessions:[{...sessions[0],liveState:'idle'}, sessions[1]],prevRoster:roster})
  assert.deepEqual(next.roster.map(({id,reason})=>[id,reason]), [['a','completed'],['b','auto']])
})

test('manual sessions can be added from standby', () => {
  const {roster} = reconcileStickyRoster({sessions:[{id:'a',liveState:'idle'}],manualIds:['a']})
  assert.equal(roster[0].reason,'manual')
})

test('grid supports six panes per page without dropping entries', () => {
  const roster = Array.from({length:8},(_,i)=>({id:String(i),liveState:'running',reason:'auto'}))
  assert.equal(selectVisiblePanes(roster).visible.length,6)
  assert.equal(selectVisiblePanes(roster,{page:1}).visible.length,2)
  for(let size=1;size<=6;size++) assert.equal(computeGridLayout(size).areas.length,size)
})

test('client keeps completed panes and prioritizes initial waiting sessions', async () => {
  const {runInNewContext} = await import('node:vm')
  const {readFile} = await import('node:fs/promises')
  let client
  runInNewContext(await readFile(new URL('../lib/client.js',import.meta.url),'utf8'), {
    window:{__ModuleLoader__:{load({factory}) { client = factory(() => ({})) }}},
  })
  const initial = client.reconcileRoster([], [{id:'a',kind:'running'},{id:'b',kind:'waiting'}])
  assert.equal(initial.map(item=>item.id).join(','),'b,a')
  const ended = client.reconcileRoster(initial,[{id:'b',kind:null},{id:'a',kind:'running'},{id:'c',kind:'waiting'}])
  assert.equal(ended.map(item=>item.id).join(','),'b,a,c')
  assert.equal(ended[0],initial[0])
  assert.equal(ended[0].seen,true)
})
