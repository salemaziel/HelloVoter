
import { hv_config } from '../app/lib/hv_config';
import neo4j from '../app/lib/neo4j';

async function makeadmin(id) {
  let db = new neo4j(hv_config);
  await db.query("match (v:Volunteer {id:{id}}) set v.admin = true", {id: id});
  db.close();
}

var args = JSON.parse(process.env.npm_config_argv);

makeadmin(args.remain[0]);

