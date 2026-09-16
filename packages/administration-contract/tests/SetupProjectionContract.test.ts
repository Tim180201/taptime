import { describe, expect, it } from 'vitest';
import {
  parseAdministrationSetupProjectionV2,
  serializeAdministrationSetupProjectionV1,
  serializeAdministrationSetupProjectionV2,
  type AdministrationSetupProjectionSource,
} from '../src/setupProjection.js';

const ids = {
  organization: '10000000-0000-4000-8000-000000000001',
  customer: '20000000-0000-4000-8000-000000000001',
  workTag: '30000000-0000-4000-8000-000000000001',
  breakTag: '30000000-0000-4000-8000-000000000002',
  unassignedTag: '30000000-0000-4000-8000-000000000003',
  workAssignment: '40000000-0000-4000-8000-000000000001',
  breakAssignment: '40000000-0000-4000-8000-000000000002',
} as const;

function source(): AdministrationSetupProjectionSource {
  return {
    organization: { id: ids.organization, name: 'TapTim.e' },
    customers: [{ id: ids.customer, displayName: 'Werkstatt', active: true }],
    nfcTags: [
      {
        id: ids.workTag,
        displayName: 'Eingang',
        validationFingerprint: 'A1B2C3D4E5F6',
        assignmentState: 'assigned',
        assignmentType: 'work',
        targetCustomerId: ids.customer,
        activeAssignmentId: ids.workAssignment,
      },
      {
        id: ids.breakTag,
        displayName: 'Pause',
        validationFingerprint: 'B1C2D3E4F5A6',
        assignmentState: 'assigned',
        assignmentType: 'break',
        targetCustomerId: null,
        activeAssignmentId: ids.breakAssignment,
      },
      {
        id: ids.unassignedTag,
        displayName: 'Reserve',
        validationFingerprint: 'C1D2E3F4A5B6',
        assignmentState: 'unassigned',
        assignmentType: null,
        targetCustomerId: null,
        activeAssignmentId: null,
      },
    ],
    nextCursor: null,
  };
}

describe('administration setup projection seam', () => {
  it('reads the exact v2 response produced by the Backend for work, break, and unassigned Tags', () => {
    const backendResponse = serializeAdministrationSetupProjectionV2(source());

    expect(backendResponse).toEqual({
      status: 'succeeded',
      organization: { id: ids.organization, name: 'TapTim.e' },
      customers: [{ id: ids.customer, displayName: 'Werkstatt', active: true }],
      nfcTags: [
        {
          id: ids.workTag,
          displayName: 'Eingang',
          validationFingerprint: 'A1B2C3D4E5F6',
          assignmentState: 'assigned',
          assignmentType: 'work',
          targetCustomerId: ids.customer,
          activeAssignmentId: ids.workAssignment,
        },
        {
          id: ids.breakTag,
          displayName: 'Pause',
          validationFingerprint: 'B1C2D3E4F5A6',
          assignmentState: 'assigned',
          assignmentType: 'break',
          targetCustomerId: null,
          activeAssignmentId: ids.breakAssignment,
        },
        {
          id: ids.unassignedTag,
          displayName: 'Reserve',
          validationFingerprint: 'C1D2E3F4A5B6',
          assignmentState: 'unassigned',
          assignmentType: null,
          targetCustomerId: null,
          activeAssignmentId: null,
        },
      ],
      nextCursor: null,
    });
    expect(parseAdministrationSetupProjectionV2(backendResponse)).toMatchObject({
      customersComplete: true,
      nfcTagsComplete: true,
      customers: [{ id: ids.customer }],
      nfcTags: [
        { id: ids.workTag, assignmentType: 'work', targetCustomerId: ids.customer },
        { id: ids.breakTag, assignmentType: 'break', targetCustomerId: null },
        { id: ids.unassignedTag, assignmentType: null, targetCustomerId: null },
      ],
    });
  });

  it('keeps the established Mobile v1 response shape with its Assignment type', () => {
    const backendResponse = serializeAdministrationSetupProjectionV1(source());

    expect(backendResponse.nfcTags.map((tag) => tag.assignmentType))
      .toEqual(['work', 'break', null]);
  });

  it('rejects an added Backend envelope field so an unversioned contract change makes CI red', () => {
    const backendResponse = serializeAdministrationSetupProjectionV2(source());

    expect(parseAdministrationSetupProjectionV2({
      ...backendResponse,
      additiveFieldWithoutNewVersion: true,
    })).toBeNull();
  });

  it('keeps valid list rows but marks their counts incomplete while the envelope stays fail closed', () => {
    const backendResponse = serializeAdministrationSetupProjectionV2(source());
    const parsed = parseAdministrationSetupProjectionV2({
      ...backendResponse,
      customers: [
        backendResponse.customers[0],
        { ...backendResponse.customers[0], unexpected: true },
      ],
      nfcTags: [
        backendResponse.nfcTags[0],
        { ...backendResponse.nfcTags[1], targetCustomerId: ids.customer },
      ],
    });

    expect(parsed).toMatchObject({
      customers: [{ id: ids.customer }],
      nfcTags: [{ id: ids.workTag }],
      customersComplete: false,
      nfcTagsComplete: false,
    });
    expect(parseAdministrationSetupProjectionV2({
      ...backendResponse,
      nextCursor: 'not-a-cursor',
    })).toBeNull();
  });
});
