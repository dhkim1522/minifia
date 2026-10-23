/** minifia 컴포넌트 타입 (문서용). window.Minifia 에 있다. */
type Role = 'mafia' | 'police' | 'doctor' | 'citizen';
type SeatState = 'default' | 'disconnected' | 'dead';
export interface ButtonProps { variant?: 'primary' | 'secondary' | 'text'; block?: boolean; compact?: boolean; icon?: string; disabled?: boolean; onClick?: () => void; children?: any }
export interface ChipProps { selected?: boolean; icon?: string; disabled?: boolean; onClick?: () => void; children?: any }
export interface TextFieldProps { id?: string; label?: string; placeholder?: string; value?: string; error?: string; code?: boolean }
export interface TimerProps { remainingMs: number; durationMs: number }
export interface PhaseBarProps { phase: string; instruction: string; remainingMs?: number; durationMs?: number; extra?: any }
export interface NoticeProps { tone?: 'default' | 'private'; icon?: string; children?: any }
export interface ReconnectBannerProps { text?: string }
export interface ConfirmSheetProps { title: string; body?: string; confirmLabel: string; cancelLabel?: string; overlay?: boolean; onConfirm?: () => void; onCancel?: () => void }
export interface RoleCardProps { role?: Role | null; face?: 'back' | 'front'; mates?: string[]; onFlip?: () => void }
export interface MyRoleButtonProps { held?: boolean; hint?: string }
export interface FigureProps { variant?: number; state?: SeatState; label?: string }
export interface Seat { name: string; variant?: number; me?: boolean; host?: boolean; mate?: boolean; state?: SeatState; claim?: string; changed?: boolean; bubble?: string; reaction?: string; votes?: number; selectable?: boolean; selected?: boolean; candidate?: boolean; pressable?: boolean }
export interface TableProps { seats: (Seat | null)[]; mySeat?: number; bare?: boolean; dimmed?: boolean; morning?: boolean; center?: any; label?: string; onSeatPress?: (seat: number) => void }
export interface BackdropProps { variant?: 'lobby' | 'night' | 'day' | 'verdict'; layout?: 'game' | 'entry'; position?: string; children?: any }
export interface EmojiBarProps { disabled?: boolean }
export interface QuickMessagePanelProps { templates: string[]; active?: number; options?: string[]; picked?: string; preview?: any; ready?: boolean }
export interface MessageLogProps { items: { from: string; text: string; variant?: number }[] }
export interface VerdictPickerProps { target?: string; value?: 'yes' | 'no' }
export interface AnnouncementProps { title: string; sub?: string; tone?: 'neutral' | 'danger'; icon?: string }
export interface ResultListProps { players: { name: string; role: Role; dead?: boolean; me?: boolean; variant?: number }[] }
export interface IconProps { name: string; size?: number; label?: string }
