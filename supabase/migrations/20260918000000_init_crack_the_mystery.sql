-- ==========================================================
-- CRACK THE MYSTERY - RAMCO INSTITUTE OF TECHNOLOGY
-- MINI ESCAPE ROOM CHALLENGE DATABASE SCHEMA & MIGRATIONS
-- ==========================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    register_number VARCHAR(50) NOT NULL,
    department VARCHAR(100) NOT NULL,
    college VARCHAR(200) NOT NULL DEFAULT 'Ramco Institute of Technology',
    avatar_seed VARCHAR(50) NOT NULL DEFAULT 'cyber-detective',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ROOMS TABLE
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL,
    team_name VARCHAR(150) NOT NULL,
    leader_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    max_capacity INT NOT NULL DEFAULT 5 CHECK (max_capacity BETWEEN 2 AND 8),
    status VARCHAR(30) NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'in_progress', 'completed', 'locked')),
    current_puzzle_number INT NOT NULL DEFAULT 1 CHECK (current_puzzle_number BETWEEN 1 AND 15),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ROOM MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.room_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    is_online BOOLEAN NOT NULL DEFAULT true,
    is_ready BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_room_participant UNIQUE (room_id, participant_id)
);

-- 5. PUZZLES TABLE (Never expose answers directly to client RLS)
CREATE TABLE IF NOT EXISTS public.puzzles (
    id VARCHAR(50) PRIMARY KEY,
    puzzle_number INT UNIQUE NOT NULL,
    title VARCHAR(150) NOT NULL,
    theme VARCHAR(100) NOT NULL,
    difficulty VARCHAR(30) NOT NULL CHECK (difficulty IN ('simple', 'moderate', 'hard')),
    story TEXT NOT NULL,
    final_answer VARCHAR(100) NOT NULL,
    final_answer_hint TEXT NOT NULL,
    fragment_formula TEXT NOT NULL,
    accepted_final_answers TEXT[] NOT NULL
);

-- 6. CLUES TABLE
CREATE TABLE IF NOT EXISTS public.clues (
    id VARCHAR(50) PRIMARY KEY,
    puzzle_id VARCHAR(50) NOT NULL REFERENCES public.puzzles(id) ON DELETE CASCADE,
    clue_number INT NOT NULL CHECK (clue_number BETWEEN 1 AND 5),
    title VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL,
    prompt TEXT NOT NULL,
    sub_prompt TEXT,
    hint TEXT,
    fragment_label VARCHAR(100) NOT NULL,
    fragment_description TEXT NOT NULL,
    expected_fragment VARCHAR(100) NOT NULL,
    accepted_answers TEXT[] NOT NULL,
    CONSTRAINT unique_puzzle_clue UNIQUE (puzzle_id, clue_number)
);

-- 7. CLUE PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.clue_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    puzzle_id VARCHAR(50) NOT NULL REFERENCES public.puzzles(id) ON DELETE CASCADE,
    clue_id VARCHAR(50) NOT NULL REFERENCES public.clues(id) ON DELETE CASCADE,
    clue_number INT NOT NULL,
    is_solved BOOLEAN NOT NULL DEFAULT true,
    solved_by_participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    earned_fragment VARCHAR(100) NOT NULL,
    solved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_room_clue_progress UNIQUE (room_id, puzzle_id, clue_id)
);

-- 8. PUZZLE PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.puzzle_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    puzzle_id VARCHAR(50) NOT NULL REFERENCES public.puzzles(id) ON DELETE CASCADE,
    puzzle_number INT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT true,
    completed_by_participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_room_puzzle_progress UNIQUE (room_id, puzzle_id)
);

-- 9. ANSWER SUBMISSIONS AUDIT LOG
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    puzzle_id VARCHAR(50) NOT NULL REFERENCES public.puzzles(id) ON DELETE CASCADE,
    clue_id VARCHAR(50) REFERENCES public.clues(id) ON DELETE CASCADE,
    clue_number INT,
    submitted_by_participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    submission_type VARCHAR(20) NOT NULL CHECK (submission_type IN ('clue', 'final')),
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. INDEXES FOR HIGH-THROUGHPUT CONCURRENCY
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_room_members_room ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_clue_progress_room ON public.clue_progress(room_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_progress_room ON public.puzzle_progress(room_id);
CREATE INDEX IF NOT EXISTS idx_submissions_room ON public.submissions(room_id);

-- 11. SECURE SERVER FUNCTIONS FOR ANSWER VERIFICATION
-- Safe Clue Verification
CREATE OR REPLACE FUNCTION public.verify_clue_submission(
    p_room_id UUID,
    p_puzzle_id VARCHAR(50),
    p_clue_id VARCHAR(50),
    p_participant_id UUID,
    p_raw_answer TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clue RECORD;
    v_room RECORD;
    v_norm_input TEXT;
    v_is_correct BOOLEAN := false;
    v_accepted TEXT;
    v_prev_clue_id VARCHAR(50);
    v_prev_solved BOOLEAN;
BEGIN
    SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Room not found.');
    END IF;

    IF v_room.status = 'locked' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Room is locked by administrator.');
    END IF;

    SELECT * INTO v_clue FROM public.clues WHERE id = p_clue_id AND puzzle_id = p_puzzle_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Clue not found.');
    END IF;

    -- Sequential enforcement
    IF v_clue.clue_number > 1 THEN
        SELECT id INTO v_prev_clue_id 
        FROM public.clues 
        WHERE puzzle_id = p_puzzle_id AND clue_number = v_clue.clue_number - 1;

        SELECT is_solved INTO v_prev_solved
        FROM public.clue_progress
        WHERE room_id = p_room_id AND puzzle_id = p_puzzle_id AND clue_id = v_prev_clue_id;

        IF v_prev_solved IS NULL OR v_prev_solved = false THEN
            RETURN jsonb_build_object('success', false, 'message', 'Sequential lock: Solve previous clue first!');
        END IF;
    END IF;

    -- Answer normalization (strip spaces & special chars, uppercase)
    v_norm_input := UPPER(REGEXP_REPLACE(TRIM(p_raw_answer), '[\s\-_.,!?:;'']', '', 'g'));

    FOREACH v_accepted IN ARRAY v_clue.accepted_answers LOOP
        IF UPPER(REGEXP_REPLACE(TRIM(v_accepted), '[\s\-_.,!?:;'']', '', 'g')) = v_norm_input THEN
            v_is_correct := true;
            EXIT;
        END IF;
    END LOOP;

    -- Audit submission
    INSERT INTO public.submissions (
        room_id, puzzle_id, clue_id, clue_number, 
        submitted_by_participant_id, submission_type, answer_text, is_correct
    ) VALUES (
        p_room_id, p_puzzle_id, p_clue_id, v_clue.clue_number,
        p_participant_id, 'clue', p_raw_answer, v_is_correct
    );

    IF NOT v_is_correct THEN
        RETURN jsonb_build_object('success', false, 'message', 'Incorrect answer. Re-evaluate the clue!');
    END IF;

    -- Insert progress idempotently
    INSERT INTO public.clue_progress (
        room_id, puzzle_id, clue_id, clue_number, 
        is_solved, solved_by_participant_id, earned_fragment
    ) VALUES (
        p_room_id, p_puzzle_id, p_clue_id, v_clue.clue_number, 
        true, p_participant_id, v_clue.expected_fragment
    ) ON CONFLICT (room_id, puzzle_id, clue_id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Clue solved successfully!', 
        'earnedFragment', v_clue.expected_fragment
    );
END;
$$;

-- Safe Final Answer Verification
CREATE OR REPLACE FUNCTION public.verify_final_answer(
    p_room_id UUID,
    p_puzzle_id VARCHAR(50),
    p_participant_id UUID,
    p_raw_answer TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_puzzle RECORD;
    v_norm_input TEXT;
    v_is_correct BOOLEAN := false;
    v_accepted TEXT;
    v_unsolved_count INT;
    v_total_completed INT;
BEGIN
    SELECT * INTO v_puzzle FROM public.puzzles WHERE id = p_puzzle_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Puzzle not found.');
    END IF;

    -- Verify all 4 prior clues solved
    SELECT COUNT(*) INTO v_unsolved_count
    FROM public.clues c
    LEFT JOIN public.clue_progress cp ON cp.clue_id = c.id AND cp.room_id = p_room_id
    WHERE c.puzzle_id = p_puzzle_id AND c.clue_number < 5 AND (cp.is_solved IS NULL OR cp.is_solved = false);

    IF v_unsolved_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vault Locked: All 4 fragments must be collected first!');
    END IF;

    v_norm_input := UPPER(REGEXP_REPLACE(TRIM(p_raw_answer), '[\s\-_.,!?:;'']', '', 'g'));

    FOREACH v_accepted IN ARRAY v_puzzle.accepted_final_answers LOOP
        IF UPPER(REGEXP_REPLACE(TRIM(v_accepted), '[\s\-_.,!?:;'']', '', 'g')) = v_norm_input THEN
            v_is_correct := true;
            EXIT;
        END IF;
    END LOOP;

    -- Audit submission
    INSERT INTO public.submissions (
        room_id, puzzle_id, clue_number, 
        submitted_by_participant_id, submission_type, answer_text, is_correct
    ) VALUES (
        p_room_id, p_puzzle_id, 5,
        p_participant_id, 'final', p_raw_answer, v_is_correct
    );

    IF NOT v_is_correct THEN
        RETURN jsonb_build_object('success', false, 'message', 'Incorrect final answer synthesis.');
    END IF;

    -- Record puzzle completion
    INSERT INTO public.puzzle_progress (
        room_id, puzzle_id, puzzle_number, is_completed, completed_by_participant_id
    ) VALUES (
        p_room_id, p_puzzle_id, v_puzzle.puzzle_number, true, p_participant_id
    ) ON CONFLICT (room_id, puzzle_id) DO NOTHING;

    -- Check if all 15 completed
    SELECT COUNT(*) INTO v_total_completed
    FROM public.puzzle_progress
    WHERE room_id = p_room_id AND is_completed = true;

    IF v_total_completed >= 15 THEN
        UPDATE public.rooms SET status = 'completed', updated_at = NOW() WHERE id = p_room_id;
    ELSE
        UPDATE public.rooms 
        SET current_puzzle_number = LEAST(15, v_puzzle.puzzle_number + 1), updated_at = NOW() 
        WHERE id = p_room_id AND current_puzzle_number = v_puzzle.puzzle_number;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Main puzzle unlocked!',
        'allCompleted', (v_total_completed >= 15)
    );
END;
$$;

-- 12. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clue_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Read policies
CREATE POLICY "Public read for active rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Public read for members" ON public.room_members FOR SELECT USING (true);
CREATE POLICY "Public read for clue progress" ON public.clue_progress FOR SELECT USING (true);
CREATE POLICY "Public read for puzzle progress" ON public.puzzle_progress FOR SELECT USING (true);
CREATE POLICY "Public read for participants" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Public read for submissions" ON public.submissions FOR SELECT USING (true);

-- Write policies for anonymous participants
CREATE POLICY "Public insert for participants" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update for participants" ON public.participants FOR UPDATE USING (true);

CREATE POLICY "Public insert for rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update for rooms" ON public.rooms FOR UPDATE USING (true);
CREATE POLICY "Public delete for rooms" ON public.rooms FOR DELETE USING (true);

CREATE POLICY "Public insert for room_members" ON public.room_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update for room_members" ON public.room_members FOR UPDATE USING (true);
CREATE POLICY "Public delete for room_members" ON public.room_members FOR DELETE USING (true);

CREATE POLICY "Public insert for clue_progress" ON public.clue_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update for clue_progress" ON public.clue_progress FOR UPDATE USING (true);
CREATE POLICY "Public delete for clue_progress" ON public.clue_progress FOR DELETE USING (true);

CREATE POLICY "Public insert for puzzle_progress" ON public.puzzle_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update for puzzle_progress" ON public.puzzle_progress FOR UPDATE USING (true);
CREATE POLICY "Public delete for puzzle_progress" ON public.puzzle_progress FOR DELETE USING (true);

CREATE POLICY "Public insert for submissions" ON public.submissions FOR INSERT WITH CHECK (true);

-- Enable Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clue_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.puzzle_progress;
