import { PrivyClient } from '@privy-io/node';

type VerifiedIdentity = { privyUserId: string; email: string; walletAddress: string };
let client: PrivyClient | undefined;

function getClient() {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) throw Object.assign(new Error('Privy backend credentials are not configured.'), { status: 503 });
  if (!client) client = new PrivyClient({ appId, appSecret });
  return client;
}

export async function verifyPrivyRequest(request: Request): Promise<VerifiedIdentity> {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw Object.assign(new Error('Privy access token required.'), { status: 401 });
  const token = authorization.slice(7);
  const privy = getClient();
  const claims = await privy.utils().auth().verifyAccessToken(token);
  const user = await privy.users()._get(claims.user_id);
  const accounts = user.linked_accounts || [];
  const emailAccount = accounts.find((account) => account.type === 'email') as { address?: string } | undefined;
  const walletAccount = accounts.find((account) => account.type === 'wallet' && 'chain_type' in account && account.chain_type === 'ethereum') as { address?: string } | undefined;
  if (!emailAccount?.address) throw Object.assign(new Error('A verified email is required.'), { status: 400 });
  if (!walletAccount?.address) throw Object.assign(new Error('Privy has not created the embedded wallet yet.'), { status: 409 });
  return { privyUserId: claims.user_id, email: emailAccount.address.toLowerCase(), walletAddress: walletAccount.address.toLowerCase() };
}
