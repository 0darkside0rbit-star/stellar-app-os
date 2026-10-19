import type { Metadata } from 'next';
import { ApiDocumentationClient } from '@/components/organisms/ApiDocumentation/ApiDocumentationClient';

export const metadata: Metadata = {
  title: 'API Documentation | FarmCredit',
  description:
    'FarmCredit API reference with endpoint details, including the farmer income prediction endpoint for carbon projects, blockchain-based tree ownership records on Stellar (transaction hashes, ownership history ledger, and on-chain sponsorship transfers), request/response examples, authentication guidance, and rate limits.',
};

export default function ApiDocumentationPage() {
  return <ApiDocumentationClient />;
}
