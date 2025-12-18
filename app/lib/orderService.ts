
import { createClient } from './supabaseClient';
import { trackActivity } from './activityTrackingService';
import { enableFollowUpsForLead } from './followUpService';

export interface OrderItem {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    variations: Record<string, unknown> | null;
}

export interface Order {
    id: string;
    lead_id: string;
    status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
    is_cod: boolean;
    total_amount: number;
    currency: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
    leads?: {
        name: string | null;
        email: string | null;
        phone: string | null;
        sender_id?: string;
    };
    order_items?: OrderItem[];
}

// Order completion statuses that should trigger the order_completed activity tracking
const ORDER_COMPLETION_STATUSES = ['confirmed', 'shipped', 'delivered'];

export async function getOrders() {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            leads (
                name,
                email,
                phone
            ),
            order_items (
                *
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching orders:', error);
        throw error;
    }

    return data as Order[];
}

export async function updateOrderStatus(orderId: string, status: string) {
    const supabase = createClient();

    // First, get the order with lead info to track the activity
    const { data: orderWithLead, error: fetchError } = await supabase
        .from('orders')
        .select(`
            id,
            lead_id,
            total_amount,
            leads (
                sender_id
            )
        `)
        .eq('id', orderId)
        .single();

    if (fetchError) {
        console.error('Error fetching order for activity tracking:', fetchError);
    }

    // Update the order status
    const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        console.error('Error updating order status:', error);
        throw error;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leadData = orderWithLead?.leads as any;
    const senderId = leadData?.sender_id;

    // Track order_completed activity when status changes to a completion status
    if (senderId && ORDER_COMPLETION_STATUSES.includes(status)) {
        console.log(`[OrderService] Tracking order_completed for sender ${senderId}`);
        trackActivity(
            senderId,
            'order_completed',
            orderId,
            `Order #${orderId.slice(-8)}`,
            {
                order_id: orderId,
                status: status,
                total_amount: orderWithLead?.total_amount
            }
        ).catch(err => {
            console.error('[OrderService] Error tracking order_completed activity:', err);
        });
    }

    // Re-enable follow-ups if order is cancelled (to re-engage the customer)
    if (senderId && status === 'cancelled') {
        console.log(`[OrderService] Order cancelled - re-enabling follow-ups for sender ${senderId}`);
        enableFollowUpsForLead(senderId).catch(err => {
            console.error('[OrderService] Error re-enabling follow-ups:', err);
        });
    }

    return data;
}

export async function deleteOrder(orderId: string) {
    const supabase = createClient();

    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

    if (error) {
        console.error('Error deleting order:', error);
        throw error;
    }

    return true;
}

export async function updatePaymentStatus(orderId: string, paymentStatus: string, isCod?: boolean) {
    const supabase = createClient();

    const updateData: { payment_status: string; is_cod?: boolean } = {
        payment_status: paymentStatus
    };

    // Only update is_cod if explicitly provided
    if (isCod !== undefined) {
        updateData.is_cod = isCod;
    }

    const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        console.error('Error updating payment status:', error);
        throw error;
    }

    return data;
}
