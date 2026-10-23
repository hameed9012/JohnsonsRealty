// Johnson's Realty design system — component props. Loaded as window.JR (React 18).
import * as React from 'react';

export type StatusKey = 'available' | 'active' | 'just-listed' | 'coming-soon' | 'price-reduced' | 'under-offer' | 'under-contract' | 'sold' | 'settled' | 'for-lease' | 'leased' | 'draft' | 'off-market' | 'withdrawn' | 'archived' | 'pending-review' | 'changes-requested' | 'rejected' | 'listed-by-owner' | 'confidential';
export type IconName = 'activity' | 'area' | 'bell' | 'arrow-right' | 'bath' | 'bed' | 'calendar' | 'camera' | 'chart' | 'chat' | 'check' | 'document' | 'dollar' | 'filter' | 'fire' | 'garage' | 'gate' | 'heart' | 'home' | 'image' | 'inbox' | 'key' | 'laundry' | 'list' | 'lock' | 'lot' | 'menu' | 'office' | 'pin' | 'pipeline' | 'police' | 'pool' | 'school' | 'search' | 'settings' | 'share' | 'stamp' | 'user' | 'users';
export type Option = string | { value: string; label: string };

/** Mark alone or lockup with wordmark. */
export interface LogoProps { variant?: 'lockup' | 'mark'; tone?: 'light' | 'dark'; small?: boolean; size?: number; subline?: string | false; href?: string; className?: string; }
/** House line icon; colour from currentColor. */
export interface IconProps { name: IconName; size?: number; label?: string; className?: string; }
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'sm'; icon?: IconName; iconRight?: IconName; withKey?: boolean; loading?: boolean; href?: string; children?: React.ReactNode; }
export interface FilterChipProps { selected?: boolean; count?: number; onClick?: React.MouseEventHandler; children?: React.ReactNode; }
export interface StatusStampProps { status: StatusKey; label?: string; variant?: 'stamp' | 'ribbon'; size?: 'sm' | 'lg'; press?: boolean; className?: string; }
export interface StatusPillProps { status: StatusKey; label?: string; className?: string; }
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> { label: string; hint?: string; error?: string; mono?: boolean; multiline?: boolean; rows?: number; }
export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> { label: string; options: Option[]; placeholder?: string; hint?: string; error?: string; }
export interface SearchField { name: string; label: string; options: Option[]; value?: string; }
export interface SearchBarProps { fields: SearchField[]; onSearch?: (e: React.FormEvent<HTMLFormElement>) => void; submitLabel?: string; }
export interface Fact { icon?: IconName; text: string; }
export interface ListingCardProps { address: string; price: number; status?: StatusKey; statusLabel?: string; area?: string; photo?: string; photoAlt?: string; href?: string; facts?: Fact[]; priceKind?: 'sale' | 'rent' | 'sold' | 'reduced'; priceLabel?: string; previousPrice?: number; saved?: boolean; onSave?: React.MouseEventHandler; layout?: 'grid' | 'list'; className?: string; }
export interface PriceDisplayProps { amount: number; kind?: 'sale' | 'rent' | 'sold' | 'reduced'; previous?: number; label?: string; size?: 'md' | 'xl'; className?: string; }
export interface StatRowProps { items: { icon?: IconName; value: React.ReactNode; label: string }[]; className?: string; }
export interface AreaChipProps { name: string; zip?: string; count?: number; href?: string; }
export interface AgentCardProps { name: string; title?: string; handle?: string; photo?: string; stats?: { value: React.ReactNode; label: string }[]; onContact?: React.MouseEventHandler; href?: string; actionLabel?: string; action?: false; className?: string; }
export interface SaleRow { no: string; date: string; address: string; area?: string; agent?: string; status?: StatusKey; price: number; [extra: string]: unknown; }
export interface SalesLedgerProps { rows: SaleRow[]; columns?: ('no' | 'date' | 'property' | 'agent' | 'status' | 'price' | string)[]; caption?: string; total?: number; totalLabel?: string; }
export interface ProcessStepsProps { steps: { title: string; text: string }[]; }
export interface ReferenceReceiptProps { title: string; reference: string; eyebrow?: string; refLabel?: string; text?: string; action?: React.ReactNode; }
export interface EmptyStateProps { title: string; text?: string; icon?: IconName; action?: React.ReactNode; }
export interface NavBarProps { links: { label: string; href: string; active?: boolean }[]; homeHref?: string; portalHref?: string; cta?: { label: string; href: string }; onMenu?: React.MouseEventHandler; }
export interface PortalSidebarProps { groups: { label?: string; items: { icon: IconName; label: string; href: string; active?: boolean; count?: number }[] }[]; user?: { name: string; role: string }; }
export interface DocumentHeaderProps { title: string; subtitle?: string; formNo?: string; contact?: { label?: string; value: string }[]; subline?: string; }
export interface SignatureLineProps { label: string; name?: string; date?: string; }
export interface ConfidentialPanelProps { rows: { label: string; value?: React.ReactNode; mono?: boolean }[]; title?: string; note?: string; redacted?: boolean; }
export interface StatTileProps { label: string; value: React.ReactNode; meta?: string; trend?: 'up' | 'down'; }
export interface PipelineCardProps { status: StatusKey; address: string; value: number; client?: string; due?: string; agent?: string; }
export interface ToastProps { message: string; tone?: 'default' | 'success' | 'danger'; action?: { label: string; onClick: () => void }; }

declare global {
  interface Window {
    JR: {
      Logo: React.FC<LogoProps>; Icon: React.FC<IconProps> & { names: IconName[] }; Button: React.FC<ButtonProps>; FilterChip: React.FC<FilterChipProps>;
      StatusStamp: React.FC<StatusStampProps>; StatusPill: React.FC<StatusPillProps>; TextField: React.FC<TextFieldProps>; SelectField: React.FC<SelectFieldProps>;
      SearchBar: React.FC<SearchBarProps>; ListingCard: React.FC<ListingCardProps>; PriceDisplay: React.FC<PriceDisplayProps>; StatRow: React.FC<StatRowProps>;
      AreaChip: React.FC<AreaChipProps>; AgentCard: React.FC<AgentCardProps>; SalesLedger: React.FC<SalesLedgerProps>; ProcessSteps: React.FC<ProcessStepsProps>;
      ReferenceReceipt: React.FC<ReferenceReceiptProps>; EmptyState: React.FC<EmptyStateProps>; NavBar: React.FC<NavBarProps>; PortalSidebar: React.FC<PortalSidebarProps>;
      DocumentHeader: React.FC<DocumentHeaderProps>; SignatureLine: React.FC<SignatureLineProps>; ConfidentialPanel: React.FC<ConfidentialPanelProps>;
      StatTile: React.FC<StatTileProps>; PipelineCard: React.FC<PipelineCardProps>; Toast: React.FC<ToastProps>;
      STATUS: Record<StatusKey, [label: string, tone: string]>;
    };
  }
}
