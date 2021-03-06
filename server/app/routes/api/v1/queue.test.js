
import { expect } from 'chai';

import { hv_config } from '../../../lib/hv_config';
import neo4j from '../../../lib/neo4j';
import { appInit, base_uri, getObjs } from '../../../../test/lib/utils';

var api;
var db;
var c, turfs;

describe('Queue', function () {

  before(async () => {
    db = new neo4j(hv_config);
    api = await appInit(db);
    c = getObjs('volunteers');
    turfs = getObjs('turfs');
  });

  after(async () => {
    db.close();
  });

  // list

  it('list as non-admin', async () => {
    let r = await api.get(base_uri+'/queue')
      .set('Authorization', 'Bearer '+c.bob.jwt);
    expect(r.statusCode).to.equal(403);
  });

  // TODO: this test needs queue.test.js to execute first
  it('list as admin', async () => {
    let r = await api.get(base_uri+'/queue')
      .set('Authorization', 'Bearer '+c.admin.jwt);
    expect(r.statusCode).to.equal(200);
    expect(r.body.queue.length).to.equal(4);
  });

});
