window.__ModuleLoader__.load({
  id: 'dsh-nexus-grid',
  factory(require) {
    const React = require('react')
    const { createElement: h, useEffect, useState } = React
    const id = 'dsh-nexus-grid'
    const slot = `${id}.conversation`
    const limit = 6
    const identity = value => value
    const en = { title: 'Session radar', waiting: 'Waiting for input', running: 'Running', done: 'Finished', manual: 'Manual', empty: 'No active sessions', hint: 'Running sessions and requests for your input will appear here automatically.', recent: 'Recent sessions', add: 'Open selected in grid', remove: 'Remove pane', clear: 'Clear finished', loading: 'Loading sessions…', error: 'Could not load conversation', retry: 'Retry', previous: 'Previous page', next: 'Next page' }
    const zh = { title: '会话雷达', waiting: '等待输入', running: '运行中', done: '已结束', manual: '手动加入', empty: '当前无活跃会话', hint: '正在运行或等待你操作的会话会自动出现在这里。', recent: '最近会话', add: '将选中会话加入分屏', remove: '移除分屏', clear: '清理已结束会话', loading: '正在加载会话…', error: '无法加载对话', retry: '重试', previous: '上一页', next: '下一页' }
    const css = `
      [data-nexus] {height:100%;box-sizing:border-box;display:flex;flex-direction:column;min-height:0;container-type:inline-size;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
      [data-nexus] .nx-head {display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:calc(14px + var(--dsh-frame-top-clearance,0px)) 16px 12px}
      [data-nexus] h1 {font-size:20px;font-weight:500;margin:0}
      [data-nexus] .nx-grid {flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(var(--nx-cols),minmax(0,1fr));grid-auto-rows:minmax(320px,1fr);gap:10px;padding:0 16px 16px}
      [data-nexus] .nx-pane {display:flex;flex-direction:column;min-width:0;min-height:0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden}
      [data-nexus] .nx-pane-head {display:flex;gap:8px;align-items:center;padding:6px 10px;background:var(--dsw-alias-bg-layer-1)}
      [data-nexus] .nx-title {flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
      [data-nexus] .nx-body {display:flex;flex:1;min-height:0;min-width:0}
      [data-nexus] .nx-empty {text-align:center;padding:24px 12px;color:var(--dsw-alias-label-secondary)}
      [data-nexus] .nx-content {flex:1;overflow:auto;padding:0 16px 16px}
      [data-nexus] details {margin:0 auto 10px;max-width:620px}
      [data-nexus] summary,[data-nexus] label {cursor:pointer}
      [data-nexus] label {display:block;padding:5px 0;overflow-wrap:anywhere}
      [data-nexus] .nx-button {cursor:pointer;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:4px 8px;background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit}
      [data-nexus] .nx-button:disabled {cursor:default;opacity:.5}
      [data-nexus] .nx-button:focus-visible {outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
      [data-nexus] .nx-status {font-size:12px;color:var(--dsw-alias-label-secondary)}
      [data-nexus] [data-state=waiting] {color:var(--dsw-alias-state-warn-primary)}
      [data-nexus] [data-state=running] {color:var(--dsw-alias-brand-primary)}
      @container (max-width:1000px) {[data-nexus] .nx-grid {grid-template-columns:repeat(min(var(--nx-cols),2),minmax(0,1fr))}}
      @container (max-width:620px) {[data-nexus] .nx-grid {grid-template-columns:minmax(0,1fr)}}
    `
    function Icon({ size = 18 }) {
      return h('svg', { width:size, height:size, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.6, 'aria-hidden':true }, h('circle',{cx:12,cy:12,r:9}), h('circle',{cx:12,cy:12,r:5}),h('path',{d:'M12 12l6-6'}),h('circle',{cx:12,cy:12,r:1,fill:'currentColor'}))
    }
    const FixedChat = props => props.renderSlot('conversation.session', { view:'chat' })
    function Conversation({renderFactorySlot}) {
      return renderFactorySlot('conversation.content', { variant:'embedded', phase:'active', hero:false }, { slots:{ views: FixedChat } })
    }
    function PaneBody({ row, retain, SessionProvider, renderSlot, t }) {
      const [ref,setRef] = useState(null)
      const [error,setError] = useState(false)
      const [attempt,retry] = useState(0)
      const {id: sessionId, origin, parentId} = row
      useEffect(() => {
        const abort = new AbortController()
        let reference
        setError(false)
        setRef(null)
        try {
          const target = origin === 'subagent' && parentId ? {parentSessionId:parentId,childSessionId:sessionId,mode:'unknown'} : sessionId
          reference = retain(target, {source:id,signal:abort.signal})
          reference.ready.then(binding => {
            if (abort.signal.aborted) return
            if (binding.session.getSnapshot().openState === 'error') setError(true)
            else setRef(reference)
          }).catch(() => { if (!abort.signal.aborted) setError(true) })
        } catch { setError(true) }
        return () => { abort.abort(); reference?.release() }
      }, [retain,sessionId,origin,parentId,attempt])
      return h('div',{className:'nx-body'}, error ? h('div',{className:'nx-empty',role:'alert'},t('error'),' ',h('button',{type:'button',className:'nx-button',onClick:()=>retry(n=>n+1)},t('retry'))) : ref ? h(SessionProvider,{session:ref},renderSlot(slot,{})) : h('div',{className:'nx-empty'},t('loading')))
    }
    function reconcileRoster(old, rows) {
      const known = new Map(rows.map(row=>[row.id,row]))
      const kept = old.filter(entry=>known.has(entry.id)).map(entry=>known.get(entry.id).kind && !entry.seen ? {...entry,seen:true} : entry)
      const ids = new Set(kept.map(entry=>entry.id))
      const additions = rows.filter(row=>row.kind && !ids.has(row.id)).sort((a,b)=>Number(b.kind==='waiting')-Number(a.kind==='waiting'))
      return additions.length || kept.length!==old.length || kept.some((entry,i)=>entry!==old[i]) ? [...kept,...additions.map(row=>({id:row.id,seen:true}))] : old
    }
    function Panel({useSessions,useSessionStatus,useWorkspaces,SessionProvider,renderSlot,retain,t}) {
      const list = useSessions(identity)
      const statuses = useSessionStatus(identity)
      const archived = useWorkspaces(value => value.archivedSessionIds)
      const [roster,setRoster] = useState([])
      const [picked,setPicked] = useState([])
      const [page,setPage] = useState(0)
      const rows = React.useMemo(()=>{
        const excluded = new Set(archived)
        return [...new Set([...list.ids,...statuses.keys()])].flatMap(key=>{
          const row = list.byId[key]
          if (!row || excluded.has(key)) return []
          const state = statuses.get(key)
          const questions = list.projectionsBySession[key]?.values?.userQuestions ?? row.projectionValues?.userQuestions
          const kind = state?.pendingInteraction || questions?.active?.length ? 'waiting' : (state?.running ?? row.running) ? 'running' : null
          return [{...row,kind}]
        }).sort((a,b)=>b.updatedAt-a.updatedAt)
      },[list,statuses,archived])
      const active = rows.filter(row=>row.kind)
      const byId = new Map(rows.map(row=>[row.id,row]))
      useEffect(()=>{
        setRoster(old=>{
          return reconcileRoster(old, rows)
        })
      },[rows])
      const available = roster.filter(entry=>byId.has(entry.id))
      const pages = Math.max(1,Math.ceil(available.length/limit))
      const current = Math.min(page,pages-1)
      const visible = available.slice(current*limit,(current+1)*limit)
      const finished = available.filter(entry=>entry.seen && !byId.get(entry.id).kind)
      const recent = rows.filter(row=>!row.blank&&!row.origin&&!roster.some(entry=>entry.id===row.id)).slice(0,12)
      const selected = recent.filter(row=>picked.includes(row.id))
      const button = (text,onClick,disabled=false)=>h('button',{type:'button',className:'nx-button',onClick,disabled},text)
      return h('section',{'data-nexus':''},h('style',null,css),
        h('header',{className:'nx-head','data-window-drag':''},h('h1',null,t('title')),
          h('span',{className:'nx-status',role:'status'},`${t('waiting')} ${active.filter(r=>r.kind==='waiting').length} · ${t('running')} ${active.filter(r=>r.kind==='running').length}`),
          finished.length>0 && button(t('clear'),()=>setRoster(old=>old.filter(entry=>!finished.includes(entry)))),
          pages>1 && h(React.Fragment,null,button(t('previous'),()=>setPage(current-1),current===0),`${current+1} / ${pages}`,button(t('next'),()=>setPage(current+1),current===pages-1))),
        (!active.length || !available.length) && h('div',{className:available.length ? undefined : 'nx-content'},
          h('div',{className:'nx-empty'},list.phase!=='ready' ? t('loading') : h(React.Fragment,null,h(Icon,{size:38}),h('h2',null,t('empty')),h('p',null,t('hint')))),
          recent.length>0 && h('details',{open:available.length?undefined:true},h('summary',null,t('recent')),
            recent.map(row=>h('label',{key:row.id},h('input',{type:'checkbox',checked:picked.includes(row.id),onChange:e=>setPicked(old=>e.target.checked?[...old,row.id]:old.filter(key=>key!==row.id))}),' ',row.displayTitle)),
            button(t('add'),()=>{setRoster(old=>[...old,...selected.filter(row=>!old.some(entry=>entry.id===row.id)).map(row=>({id:row.id,seen:false}))]);setPicked([]);setPage(Math.floor(available.length/limit))},!selected.length))),
        visible.length>0 && h('div',{className:'nx-grid',style:{'--nx-cols':visible.length===1?1:visible.length<5?2:3}},visible.map(entry=>{
          const row = byId.get(entry.id)
          const state = row.kind ?? (entry.seen?'done':'manual')
          return h('article',{key:row.id,className:'nx-pane'},h('header',{className:'nx-pane-head'},h('strong',{className:'nx-title',title:row.displayTitle},row.displayTitle),h('span',{className:'nx-status','data-state':state},t(state)),!row.kind && button(t('remove'),()=>setRoster(old=>old.filter(item=>item.id!==row.id)))),h(PaneBody,{row,retain,SessionProvider,renderSlot,t}))
        })))
    }
    return {
      reconcileRoster,
      inject:['slots','locale','sessions'],
      apply(ctx) {
        const retain = (target,options)=>ctx.sessions.retain(target,options)
        ctx.effect(()=>ctx.locale.register(id,{en,zh}))
        const t = ctx.locale.bind(id)
        ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:id,locale:id,inject:()=>({retain}),children:{[slot]:{kind:'single',scope:'session'}}},Panel))
        ctx.slots.inject(slot,()=>ctx.slots.register({name:slot},Conversation))
        ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id,order:20,label:()=>t('title')},Icon))
      },
    }
  },
})
