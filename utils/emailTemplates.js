export function guestApprovalEmail({ name, submissionId, editUrl }) {
  return {
    subject: 'Guest Post Approved – Complete Your Draft',
    html: `
      <p>Hi ${name},</p>
      <p>Your guest post pitch has been approved. Please complete your draft using the link below:</p>
      <p><a href="${editUrl}">Continue Editing</a></p>
      <p>Thank you,<br/>News and Niche</p>
    `,
    text: `Hi ${name},\nYour guest post pitch has been approved. Continue editing: ${editUrl}\nThank you, News and Niche`
  };
}

export function sponsoredApprovalEmail({ name, submissionId, editUrl }) {
  return {
    subject: 'Sponsored Post Approved – Complete Your Draft',
    html: `
      <p>Hi ${name},</p>
      <p>Your sponsored post request has been approved. Please complete your draft using the link below:</p>
      <p><a href="${editUrl}">Continue Editing</a></p>
      <p>Thank you,<br/>News and Niche</p>
    `,
    text: `Hi ${name},\nYour sponsored post has been approved. Continue editing: ${editUrl}\nThank you, News and Niche`
  };
}


