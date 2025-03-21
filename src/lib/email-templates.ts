export function createVerificationEmail(url: string) {
  return {
    subject: 'Verify your email address',
    html: `
      <h1>Verify your email address</h1>
      <p>Click the link below to verify your email address:</p>
      <a href="${url}">${url}</a>
    `,
  };
}

export function createResetPasswordEmail(url: string) {
  return {
    subject: 'Reset your password',
    html: `
      <h1>Reset your password</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${url}">${url}</a>
    `,
  };
}

export function createChangeEmailVerification(url: string) {
  return {
    subject: 'Verify your new email address',
    html: `
      <h1>Verify your new email address</h1>
      <p>Click the link below to verify your new email address:</p>
      <a href="${url}">${url}</a>
    `,
  };
}

export function createDeleteAccountEmail(url: string) {
  return {
    subject: 'Confirm account deletion',
    html: `
      <h1>Confirm account deletion</h1>
      <p>Click the link below to confirm your account deletion:</p>
      <a href="${url}">${url}</a>
      <p>This action cannot be undone.</p>
    `,
  };
}
