const database = { client: 'postgres', connection: { host: 'test-only', database: 'fixture', schema: 'public' } };
function fixture() {
  const state = { projects: [], technologies: [], links: [], components: [], locales: ['ar','en'], isolation: 'repeatable read', readOnly: 'on', database: 'fixture', statements: [] };
  const fields = {
    projects: { id:'integer',document_id:'character varying',slug:'character varying',locale:'character varying',published_at:'timestamp without time zone',featured:'boolean',display_order:'integer' },
    technologies: { id:'integer',document_id:'character varying',slug:'character varying',name:'character varying' },
    i18n_locale: { code:'character varying' },
    projects_technologies_lnk: { project_id:'integer',technology_id:'integer' },
    projects_cmps: { entity_id:'integer',cmp_id:'integer',component_type:'character varying',field:'character varying' },
  };
  state.columns=Object.entries(fields).flatMap(([table_name,fields])=>Object.entries(fields).map(([column_name,data_type])=>({table_name,column_name,data_type}))).sort((a,b)=>(a.table_name+':'+a.column_name).localeCompare(b.table_name+':'+b.column_name));
  state.foreignKeys=[['projects_technologies_lnk','project_id','projects'],['projects_technologies_lnk','technology_id','technologies'],['projects_cmps','entity_id','projects']].map(([table_name,column,referenced_table])=>({table_name,referenced_table,columns:[column],referenced_columns:['id']}));
  const query=async(sql,values=[])=>{
    state.statements.push({sql,values});
    if(sql.startsWith('BEGIN'))return {rows:[]};
    if(sql.startsWith('ROLLBACK')||sql.startsWith('SET')||sql.startsWith('LOCK'))return {rows:[]};
    if(sql.startsWith('SELECT current_database'))return {rows:[{database:state.database,read_only:state.readOnly,isolation:state.isolation}]};
    if(sql.startsWith("SELECT current_setting"))return {rows:[{read_only:state.readOnly}]};
    if(sql.includes('information_schema.columns'))return {rows:structuredClone(state.columns)};
    if(sql.includes('pg_constraint'))return {rows:structuredClone(state.foreignKeys)};
    if(sql.includes('SELECT code FROM'))return {rows:state.locales.map(code=>({code}))};
    for(const [table,key]of [['projects_technologies_lnk','links'],['projects_cmps','components'],['projects','projects'],['technologies','technologies']])if(sql.includes(`."${table}"`))return {rows:structuredClone(state[key])};
    throw new Error('Unexpected fixture query: '+sql);
  };
  return {state,query};
}
module.exports={database,fixture};
