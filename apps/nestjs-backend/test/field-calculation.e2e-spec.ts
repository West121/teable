/* eslint-disable @typescript-eslint/no-explicit-any */
import type { INestApplication } from '@nestjs/common';
import type { IRecord, IFieldVo, IUpdateRecordRo, IRecordsVo, IFieldRo } from '@teable-group/core';
import { FieldKeyType, FieldType } from '@teable-group/core';
import type request from 'supertest';
import { initApp } from './utils/init-app';
import { seeding } from './utils/record-mock';

describe('OpenAPI Field calculation (e2e)', () => {
  let app: INestApplication;
  let tableId = '';
  let request: request.SuperAgentTest;

  beforeAll(async () => {
    const appCtx = await initApp();
    app = appCtx.app;
    request = appCtx.request;

    const result = await request.post('/api/table').send({
      name: 'table1',
    });
    tableId = result.body.id;

    await seeding(tableId, 1000);
  });

  afterAll(async () => {
    await request.delete(`/api/table/arbitrary/${tableId}`);

    await app.close();
  });

  async function updateRecordByApi(
    tableId: string,
    recordId: string,
    fieldId: string,
    newValues: any
  ): Promise<IRecord> {
    return (
      await request
        .put(`/api/table/${tableId}/record/${recordId}`)
        .send({
          fieldKeyType: FieldKeyType.Id,
          record: {
            fields: {
              [fieldId]: newValues,
            },
          },
        } as IUpdateRecordRo)
        .expect(200)
    ).body;
  }

  async function getFields(tableId: string) {
    const fieldResult = await request.get(`/api/table/${tableId}/field`).expect(200);
    return fieldResult.body as IFieldVo[];
  }

  async function getRecords(tableId: string) {
    const recordsResult = await request.get(`/api/table/${tableId}/record`).expect(200);
    return recordsResult.body as IRecordsVo;
  }

  it('should calculate when add a non-reference formula field', async () => {
    const fieldRo: IFieldRo = {
      name: 'New formula field',
      type: FieldType.Formula,
      options: {
        expression: '1 + 1',
        formatting: {
          precision: 2,
        },
      },
    };

    const fieldCreateResult = await request
      .post(`/api/table/${tableId}/field`)
      .send(fieldRo)
      .expect(201);
    const fieldVo: IFieldVo = fieldCreateResult.body;

    const recordsResult = await request.get(`/api/table/${tableId}/record`).expect(200);
    const recordsVo: IRecordsVo = recordsResult.body;
    const equal = recordsVo.records.every((record) => record.fields[fieldVo.name] === 2);
    expect(equal).toBeTruthy();
  });

  it('should calculate when add a referenced formula field', async () => {
    const fieldsVo = await getFields(tableId);
    const recordsVo = await getRecords(tableId);

    await updateRecordByApi(tableId, recordsVo.records[0].id, fieldsVo[0].id, 'A1');
    await updateRecordByApi(tableId, recordsVo.records[1].id, fieldsVo[0].id, 'A2');
    await updateRecordByApi(tableId, recordsVo.records[2].id, fieldsVo[0].id, 'A3');

    const fieldRo: IFieldRo = {
      name: 'New formula field',
      type: FieldType.Formula,
      options: {
        expression: `{${fieldsVo[0].id}}`,
      },
    };

    const fieldCreateResult = await request
      .post(`/api/table/${tableId}/field`)
      .send(fieldRo)
      .expect(201);
    const fieldVo: IFieldVo = fieldCreateResult.body;
    const recordsVoAfter = await getRecords(tableId);

    expect(recordsVoAfter.records[0].fields[fieldVo.name]).toEqual('A1');
    expect(recordsVoAfter.records[1].fields[fieldVo.name]).toEqual('A2');
    expect(recordsVoAfter.records[2].fields[fieldVo.name]).toEqual('A3');
  });
});