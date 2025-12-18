import { NextResponse } from 'next/server';
import { getOrders, updateOrderStatus, deleteOrder, updatePaymentStatus } from '@/app/lib/orderService';

export async function GET() {
    try {
        const orders = await getOrders();
        return NextResponse.json(orders);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, status, payment_status, is_cod } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing order ID' }, { status: 400 });
        }

        let updatedOrder;

        // Handle order status update
        if (status) {
            updatedOrder = await updateOrderStatus(id, status);
        }

        // Handle payment status update
        if (payment_status !== undefined || is_cod !== undefined) {
            updatedOrder = await updatePaymentStatus(id, payment_status, is_cod);
        }

        if (!updatedOrder) {
            return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
        }

        return NextResponse.json(updatedOrder);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing order ID' }, { status: 400 });
        }

        await deleteOrder(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
    }
}
