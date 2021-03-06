
import { expect } from 'chai';

import { hv_config } from '../../app/lib/hv_config';
import neo4j from '../../app/lib/neo4j';
import { appInit, base_uri, getObjs } from '../lib/utils';

var api;
var db;
var c, turfs, forms;

describe('New Volunteer Zero Visibility', function () {

  before(async () => {
    db = new neo4j(hv_config);
    api = await appInit(db);
    c = getObjs('volunteers');
    turfs = getObjs('turfs');
    forms = getObjs('forms');
  });

  after(async () => {
    db.close();
  });

  // TODO: need to setup some assignments for these tests to be fully valid
  // TODO: need to hit more endpoints

  it('can see only self', async () => {
    let r = await api.get(base_uri+'/volunteers')
      .set('Authorization', 'Bearer '+c.mike.jwt)
    expect(r.statusCode).to.equal(200);
    expect(r.body.volunteers.length).to.equal(1);
    expect(r.body.volunteers[0].id).to.equal(c.mike.id);
  });

  it('can not list turfs', async () => {
    let r = await api.get(base_uri+'/turfs')
      .set('Authorization', 'Bearer '+c.mike.jwt)
    expect(r.statusCode).to.equal(200);
    expect(r.body.turfs.length).to.equal(0);
  });

  it('can not list forms', async () => {
    let r = await api.get(base_uri+'/forms')
      .set('Authorization', 'Bearer '+c.mike.jwt)
    expect(r.statusCode).to.equal(200);
    expect(r.body.forms.length).to.equal(0);
  });
});
