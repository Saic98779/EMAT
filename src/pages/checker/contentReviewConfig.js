// Checker review — per-content-type metadata.
//
// Keeps the review UI declarative: the queue page reads `label`, `overline`,
// and `columns` for its tabs; the review detail page reads `sections` +
// `fields` to render the record as read-only cards.
//
// Fields:
//   key       — property name on the response DTO
//   label     — human-facing label
//   type      — 'text' (default) | 'date' | 'datetime' | 'multiline' | 'chips'
//               | 'money' | 'link' | 'number'
//   hide      — when true, don't render this field even if the DTO has it
//   full      — when true, take the whole 12-col row (multiline defaults to full)

const AUDIT_FIELDS = [
  { key: 'createdBy',  label: 'Submitted by' },
  { key: 'createdAt',  label: 'Submitted on', type: 'datetime' },
  { key: 'updatedBy',  label: 'Last updated by' },
  { key: 'updatedAt',  label: 'Last updated on', type: 'datetime' },
  { key: 'approvedDate', label: 'Approved on', type: 'date' },
]

const audit = () => ({ title: 'Audit', fields: AUDIT_FIELDS })

export const CONTENT_REVIEW_TYPES = {
  'dia-3c-info-series': {
    label:    '3C Info-Series',
    overline: 'DIA · 3C Info-Series',
    detailRoute: (id) => `/checker/dia-3c-info-series/${id}`,
    columns: [
      { key: 'topic',       label: 'Topic' },
      { key: 'chapterNo',   label: 'Chapter' },
      { key: 'subjectLine', label: 'Subject' },
    ],
    sections: [
      {
        title: 'Overview',
        fields: [
          { key: 'topic',       label: 'Topic' },
          { key: 'chapterNo',   label: 'Chapter No.' },
          { key: 'subjectLine', label: 'Subject line' },
          { key: 'proposedPublishDate', label: 'Proposed publish date', type: 'date' },
          { key: 'bulkMessaging', label: 'Bulk messaging', type: 'chips' },
        ],
      },
      {
        title: 'Content',
        fields: [
          { key: 'relevanceOfTopic', label: 'Relevance of the topic', type: 'multiline' },
          { key: 'briefOfContent',   label: 'Brief of the content',   type: 'multiline' },
          { key: 'mainContent',      label: 'Main content',           type: 'multiline' },
          { key: 'attachment',       label: 'Attachment',             type: 'link' },
        ],
      },
      audit(),
    ],
  },

  'elearning-module-content': {
    label:    'E-learning Module',
    overline: 'DIA · E-learning Module',
    detailRoute: (id) => `/checker/elearning-module-content/${id}`,
    columns: [
      { key: 'topic',      label: 'Topic' },
      { key: 'moduleName', label: 'Module' },
      { key: 'placementOfModule', label: 'Placement' },
    ],
    sections: [
      {
        title: 'Overview',
        fields: [
          { key: 'topic',            label: 'Topic' },
          { key: 'moduleName',       label: 'Module name' },
          { key: 'placementOfModule', label: 'Placement of the module' },
        ],
      },
      {
        title: 'Content',
        fields: [
          { key: 'relevanceOfTopic', label: 'Relevance / rationale', type: 'multiline' },
          { key: 'briefOfContent',   label: 'Brief of the content',  type: 'multiline' },
          { key: 'mainContent',      label: 'Main content',          type: 'multiline' },
          { key: 'link',             label: 'Link',                  type: 'link' },
          { key: 'attachment',       label: 'Attachment',            type: 'link' },
        ],
      },
      audit(),
    ],
  },

  'bulk-broadcast': {
    label:    'Bulk Broadcast',
    overline: 'DIA · Bulk Broadcast',
    detailRoute: (id) => `/checker/bulk-broadcast/${id}`,
    columns: [
      { key: 'topic',             label: 'Topic' },
      { key: 'dateOfBroadcast',   label: 'Broadcast on', type: 'date' },
      { key: 'broadcastThrough',  label: 'Channel' },
    ],
    sections: [
      {
        title: 'Broadcast details',
        fields: [
          { key: 'topic',              label: 'Topic' },
          { key: 'subjectLine',        label: 'Subject line' },
          { key: 'dateOfBroadcast',    label: 'Date of broadcast', type: 'date' },
          { key: 'broadcastThrough',   label: 'Broadcast through' },
          { key: 'relevanceOfTopic',   label: 'Relevance of the topic', type: 'multiline' },
          { key: 'sampleForBroadcast', label: 'Sample for the broadcast', type: 'multiline' },
        ],
      },
      {
        title: 'Message',
        fields: [
          { key: 'mainContent', label: 'Main content', type: 'multiline' },
          { key: 'link',        label: 'Link',        type: 'link' },
          { key: 'attachment',  label: 'Attachment',  type: 'link' },
        ],
      },
      audit(),
    ],
  },

  'discussion-forum': {
    label:    'Discussion Forum',
    overline: 'DIA · Discussion Forum',
    detailRoute: (id) => `/checker/discussion-forum/${id}`,
    columns: [
      { key: 'topic',      label: 'Topic' },
      { key: 'theme',      label: 'Theme' },
      { key: 'startDate',  label: 'Start', type: 'date' },
      { key: 'endDate',    label: 'End',   type: 'date' },
    ],
    sections: [
      {
        title: 'Thread details',
        fields: [
          { key: 'topic',            label: 'Topic' },
          { key: 'theme',            label: 'Theme' },
          { key: 'globalOrOnlyMembers', label: 'Visibility' },
          { key: 'relevanceOfTopic', label: 'Relevance of the topic', type: 'multiline' },
        ],
      },
      {
        title: 'Schedule',
        fields: [
          { key: 'startDate', label: 'Start date', type: 'date' },
          { key: 'endDate',   label: 'End date',   type: 'date' },
        ],
      },
      audit(),
    ],
  },

  'latest-developments': {
    label:    'Latest Developments',
    overline: 'DIA · Latest Developments',
    detailRoute: (id) => `/checker/latest-developments/${id}`,
    columns: [
      { key: 'topic',     label: 'Topic' },
      { key: 'startDate', label: 'Start', type: 'date' },
      { key: 'endDate',   label: 'End',   type: 'date' },
    ],
    sections: [
      {
        title: 'Entry details',
        fields: [
          { key: 'topic',            label: 'Topic' },
          { key: 'relevanceOfTopic', label: 'Relevance of the topic', type: 'multiline' },
          { key: 'startDate',        label: 'Start date', type: 'date' },
          { key: 'endDate',          label: 'End date',   type: 'date' },
        ],
      },
      audit(),
    ],
  },

  'pop-ups': {
    label:    'Pop-Ups',
    overline: 'DIA · Pop-Ups',
    detailRoute: (id) => `/checker/pop-ups/${id}`,
    columns: [
      { key: 'topic',     label: 'Topic' },
      { key: 'startDate', label: 'Start', type: 'date' },
      { key: 'endDate',   label: 'End',   type: 'date' },
    ],
    sections: [
      {
        title: 'Pop-up details',
        fields: [
          { key: 'topic',            label: 'Topic' },
          { key: 'relevanceOfPopUp', label: 'Relevance of the pop-up', type: 'multiline' },
          { key: 'startDate',        label: 'Start date', type: 'date' },
          { key: 'endDate',          label: 'End date',   type: 'date' },
          { key: 'attachments',      label: 'Attachments', type: 'link' },
        ],
      },
      audit(),
    ],
  },

  'surveys': {
    label:    'Survey',
    overline: 'DIA · Survey',
    detailRoute: (id) => `/checker/surveys/${id}`,
    columns: [
      { key: 'topic',     label: 'Topic' },
      { key: 'sample',    label: 'Sample', type: 'number' },
      { key: 'startDate', label: 'Start',  type: 'date' },
      { key: 'endDate',   label: 'End',    type: 'date' },
    ],
    sections: [
      {
        title: 'Survey details',
        fields: [
          { key: 'topic',            label: 'Topic' },
          { key: 'sample',           label: 'Sample size', type: 'number' },
          { key: 'startDate',        label: 'Survey start date', type: 'date' },
          { key: 'endDate',          label: 'Survey end date',   type: 'date' },
          { key: 'bulkMessaging',    label: 'Bulk messaging', type: 'chips' },
          { key: 'relevanceOfTopic', label: 'Relevance of the topic', type: 'multiline' },
        ],
      },
      {
        title: 'Questionnaire',
        fields: [
          { key: 'surveyQuestionnaires', label: 'Questions', type: 'questionnaire' },
        ],
      },
      {
        title: 'Attachment',
        fields: [{ key: 'attachment', label: 'Attachment', type: 'link' }],
      },
      audit(),
    ],
  },

  'bdsp': {
    label:    'BDSP Onboarding',
    overline: 'DIA · BDSP Onboarding',
    detailRoute: (id) => `/checker/bdsp/${id}`,
    columns: [
      { key: 'nameOfBdsp', label: 'Name' },
      { key: 'state',      label: 'State' },
      { key: 'district',   label: 'District' },
    ],
    sections: [
      {
        title: 'BDSP identity',
        fields: [
          { key: 'nameOfBdsp', label: 'Name of BDSP' },
          { key: 'theme',      label: 'Theme' },
          { key: 'rationaleForOnboarding', label: 'Rationale for onboarding', type: 'multiline' },
          { key: 'areaOfServiceExpertise', label: 'Area of service / expertise' },
        ],
      },
      {
        title: 'Location & contact',
        fields: [
          { key: 'state',    label: 'State' },
          { key: 'district', label: 'District' },
          { key: 'contact',  label: 'Contact' },
          { key: 'email',    label: 'Email' },
          { key: 'kyc',      label: 'KYC', type: 'multiline' },
        ],
      },
      audit(),
    ],
  },

  'bds-service-providers-onboarding': {
    label:    'PBSP Onboarding',
    overline: 'DIA · Panel BDS Provider',
    detailRoute: (id) => `/checker/bds-service-providers-onboarding/${id}`,
    columns: [
      { key: 'bdsProviderName', label: 'Provider' },
      { key: 'state',           label: 'State' },
      { key: 'district',        label: 'District' },
      { key: 'sector',          label: 'Sector' },
    ],
    sections: [
      {
        title: 'Identity',
        fields: [
          { key: 'bdsProviderName', label: 'BDS provider name' },
          { key: 'doi',             label: 'Date of incorporation', type: 'date' },
          { key: 'constitution',    label: 'Constitution' },
          { key: 'iaNature',        label: 'Nature of IA' },
          { key: 'sector',          label: 'Sector' },
        ],
      },
      {
        title: 'Address',
        fields: [
          { key: 'address',  label: 'Address', type: 'multiline' },
          { key: 'state',    label: 'State' },
          { key: 'district', label: 'District' },
          { key: 'pinCode',  label: 'PIN code' },
        ],
      },
      {
        title: 'Coverage & membership',
        fields: [
          { key: 'noOfOffices',              label: 'Number of offices',                type: 'number' },
          { key: 'catTo242IdenClusterFlag',  label: '242-identified cluster',           type: 'yesNo' },
          { key: 'clusterName',              label: 'Cluster name' },
          { key: 'otherClusterIndusIa',      label: 'Other cluster / IA' },
          { key: 'totIaMembers',             label: 'Total IA members',                 type: 'number' },
          { key: 'totMsmeIaMembers',         label: 'Total MSME IA members',            type: 'number' },
          { key: 'ownAssociationIaFlag',     label: 'Runs own association / IA',        type: 'yesNo' },
        ],
      },
      {
        title: 'Infrastructure',
        fields: [
          { key: 'availOfItInfra',            label: 'IT infrastructure',               type: 'yesNo' },
          { key: 'availOfSecretariatStaffFlag', label: 'Secretariat staff',             type: 'yesNo' },
        ],
      },
      {
        title: 'Contacts',
        fields: [
          { key: 'mainExecutiveName',   label: 'Main executive name' },
          { key: 'executiveContactNo',  label: 'Executive contact number' },
          { key: 'nodalContactName',    label: 'Nodal contact name' },
          { key: 'contactNumber',       label: 'Nodal contact number' },
          { key: 'emailId',             label: 'Email ID' },
          { key: 'areaOfExpertise',     label: 'Area of expertise', type: 'multiline' },
        ],
      },
      {
        title: 'Performance',
        fields: [
          { key: 'totLeadCasesGen',    label: 'Total lead cases generated', type: 'number' },
          { key: 'casesSanctionedAmt', label: 'Cases sanctioned amount',    type: 'money' },
          { key: 'casesDisbursedAmt',  label: 'Cases disbursed amount',     type: 'money' },
        ],
      },
      {
        title: 'SIDBI mapping',
        fields: [
          { key: 'associateNameSidbiRoMappedWith', label: 'SIDBI RO mapped with' },
          { key: 'associateNameSidbiBoMappedWith', label: 'SIDBI BO mapped with' },
          { key: 'sidbiBseName',                   label: 'SIDBI BSE name' },
          { key: 'bseContactNumber',               label: 'BSE contact number' },
          { key: 'bseEmailId',                     label: 'BSE email ID' },
        ],
      },
      audit(),
    ],
  },
}

export const CONTENT_REVIEW_ORDER = [
  'dia-3c-info-series',
  'elearning-module-content',
  'bulk-broadcast',
  'discussion-forum',
  'latest-developments',
  'pop-ups',
  'surveys',
  'bdsp',
  'bds-service-providers-onboarding',
]
