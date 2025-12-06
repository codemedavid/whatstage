import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

// GET - Fetch all pipeline stages
export async function GET() {
    try {
        const { data: stages, error } = await supabase
            .from('pipeline_stages')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) {
            console.error('Error fetching stages:', error);
            return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 });
        }

        return NextResponse.json(stages || []);
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Create a new pipeline stage
export async function POST(req: Request) {
    try {
        const { name, color, description } = await req.json();

        if (!name) {
            return NextResponse.json({ error: 'Stage name is required' }, { status: 400 });
        }

        // Get the highest display_order
        const { data: lastStage } = await supabase
            .from('pipeline_stages')
            .select('display_order')
            .order('display_order', { ascending: false })
            .limit(1)
            .single();

        const newOrder = (lastStage?.display_order ?? -1) + 1;

        const { data, error } = await supabase
            .from('pipeline_stages')
            .insert({
                name,
                display_order: newOrder,
                color: color || '#64748b',
                description: description || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating stage:', error);
            return NextResponse.json({ error: 'Failed to create stage' }, { status: 500 });
        }

        return NextResponse.json({ stage: data }, { status: 201 });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH - Update a pipeline stage
export async function PATCH(req: Request) {
    try {
        const { id, name, color, description, display_order } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 });
        }

        const updates: Record<string, any> = {};
        if (name !== undefined) updates.name = name;
        if (color !== undefined) updates.color = color;
        if (description !== undefined) updates.description = description;
        if (display_order !== undefined) updates.display_order = display_order;

        const { data, error } = await supabase
            .from('pipeline_stages')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating stage:', error);
            return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 });
        }

        return NextResponse.json({ stage: data });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE - Delete a pipeline stage
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 });
        }

        // Check if any leads are in this stage
        const { count } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('current_stage_id', id);

        if (count && count > 0) {
            return NextResponse.json({
                error: 'Cannot delete stage with leads. Move leads first.'
            }, { status: 400 });
        }

        const { error } = await supabase
            .from('pipeline_stages')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting stage:', error);
            return NextResponse.json({ error: 'Failed to delete stage' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
