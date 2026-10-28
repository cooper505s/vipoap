import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
export function bookingDatabase(){
  const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
  for(const migration of ['0011_booking_transactions.sql','0012_booking_outbox_delivery.sql'])sql.exec(fs.readFileSync(new URL('../../migrations/'+migration,import.meta.url),'utf8'));
  let queue=Promise.resolve();
  const db={prepare(query){return{query,values:[],bind(...values){this.values=values;return this;},async first(){return sql.prepare(query).get(...this.values)||null;},async all(){return{results:sql.prepare(query).all(...this.values)};},async run(){const value=sql.prepare(query).run(...this.values);return{meta:{changes:Number(value.changes)}};}};},batch(statements){const run=queue.then(()=>{sql.exec('BEGIN');try{const result=statements.map(item=>{const statement=sql.prepare(item.query);if(item.query.startsWith('SELECT '))return{results:statement.all(...item.values),meta:{changes:0}};const saved=statement.run(...item.values);return{results:[],meta:{changes:Number(saved.changes)}};});sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}});queue=run.catch(()=>{});return run;}};
  return{db,sql};
}
