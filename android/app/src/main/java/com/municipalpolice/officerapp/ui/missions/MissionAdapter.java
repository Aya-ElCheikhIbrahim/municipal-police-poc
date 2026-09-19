package com.municipalpolice.officerapp.ui.missions;

import android.content.res.ColorStateList;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.card.MaterialCardView;
import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.model.Priority;
import com.municipalpolice.officerapp.util.TimeFormat;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class MissionAdapter
        extends RecyclerView.Adapter<MissionAdapter.ViewHolder> {

    public interface OnMissionClickListener {
        void onMissionClick(Mission mission);
        void onActionClick(Mission mission);
    }

    private final List<Mission> missions = new ArrayList<>();
    private final OnMissionClickListener listener;

    private android.location.Location userLocation;


    // =========================================================
    // LIVE TIMER DATA
    // =========================================================

    /*
     * duration_seconds comes from the backend.
     *
     * Example:
     * backend sends 1004 seconds
     *
     * Android remembers:
     * base = 1004
     * receivedAt = current elapsedRealtime()
     *
     * Then while mission is running:
     *
     * 1004
     * 1005
     * 1006
     * ...
     */

    private final Map<Integer, Long> timerBaseSeconds =
            new HashMap<>();

    private final Map<Integer, Long> timerBaseRealtime =
            new HashMap<>();


    // Refresh the visible timer every second.
    private final Handler timerHandler =
            new Handler(Looper.getMainLooper());

    private final Runnable timerRunnable =
            new Runnable() {
                @Override
                public void run() {

                    notifyDataSetChanged();

                    timerHandler.postDelayed(
                            this,
                            1000
                    );
                }
            };


    public MissionAdapter(
            OnMissionClickListener listener
    ) {

        this.listener = listener;

        timerHandler.post(
                timerRunnable
        );
    }


    // =========================================================
    // LIST
    // =========================================================

    public void submitList(
            List<Mission> newMissions
    ) {

        long now =
                SystemClock.elapsedRealtime();

        Set<Integer> incomingIds =
                new HashSet<>();


        if (newMissions != null) {

            for (Mission mission : newMissions) {

                int missionId =
                        mission.getId();

                incomingIds.add(
                        missionId
                );


                boolean running =
                        mission.getStatus() ==
                                MissionStatus.IN_PROGRESS ||
                                mission.getStatus() ==
                                        MissionStatus.ACKNOWLEDGED;


                if (running) {

                    long backendDuration =
                            Math.max(
                                    0,
                                    mission.getDurationSeconds()
                            );


                    Long oldBase =
                            timerBaseSeconds.get(
                                    missionId
                            );

                    Long oldRealtime =
                            timerBaseRealtime.get(
                                    missionId
                            );


                    /*
                     * First time we receive this running mission:
                     * use duration_seconds as the starting value.
                     */
                    if (oldBase == null ||
                            oldRealtime == null) {

                        timerBaseSeconds.put(
                                missionId,
                                backendDuration
                        );

                        timerBaseRealtime.put(
                                missionId,
                                now
                        );
                    }

                    else {

                        /*
                         * Calculate what Android currently believes
                         * the timer should be.
                         */
                        long localElapsed =
                                Math.max(
                                        0,
                                        (now - oldRealtime)
                                                / 1000L
                                );

                        long localCurrent =
                                oldBase +
                                        localElapsed;


                        /*
                         * Only reset the baseline when the backend
                         * has moved ahead of our local timer.
                         *
                         * This prevents RecyclerView refreshes from
                         * restarting the timer every second.
                         */
                        if (backendDuration >
                                localCurrent) {

                            timerBaseSeconds.put(
                                    missionId,
                                    backendDuration
                            );

                            timerBaseRealtime.put(
                                    missionId,
                                    now
                            );
                        }
                    }
                }

                else {

                    /*
                     * Mission isn't running anymore.
                     * Remove its live baseline.
                     *
                     * Paused/completed missions use the fixed
                     * duration_seconds returned by the backend.
                     */
                    timerBaseSeconds.remove(
                            missionId
                    );

                    timerBaseRealtime.remove(
                            missionId
                    );
                }
            }
        }


        /*
         * Remove timer information for missions that disappeared
         * from this adapter's list.
         */
        List<Integer> existingTimerIds =
                new ArrayList<>(
                        timerBaseSeconds.keySet()
                );

        for (Integer id : existingTimerIds) {

            if (!incomingIds.contains(id)) {

                timerBaseSeconds.remove(id);
                timerBaseRealtime.remove(id);
            }
        }


        missions.clear();

        if (newMissions != null) {
            missions.addAll(
                    newMissions
            );
        }

        notifyDataSetChanged();
    }


    public void setUserLocation(
            android.location.Location location
    ) {

        this.userLocation =
                location;

        notifyDataSetChanged();
    }


    // =========================================================
    // ACTIVE MISSION
    // =========================================================

    private boolean hasActiveMission() {

        for (Mission mission : missions) {

            if (mission.getStatus() ==
                    MissionStatus.ACKNOWLEDGED ||
                    mission.getStatus() ==
                            MissionStatus.IN_PROGRESS) {

                return true;
            }
        }

        return false;
    }


    // =========================================================
    // CREATE VIEW
    // =========================================================

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(
            @NonNull ViewGroup parent,
            int viewType
    ) {

        View view =
                LayoutInflater
                        .from(parent.getContext())
                        .inflate(
                                R.layout.item_mission,
                                parent,
                                false
                        );

        return new ViewHolder(
                view
        );
    }


    // =========================================================
    // BIND VIEW
    // =========================================================

    @Override
    public void onBindViewHolder(
            @NonNull ViewHolder holder,
            int position
    ) {

        Mission mission =
                missions.get(position);


        holder.tvTitle.setText(
                mission.getTitle()
        );


        // =====================================================
        // LOCATION / DISTANCE / RELATIVE TIME
        // =====================================================

        String locationStr =
                mission.getLocationDisplay();

        String distanceStr = "";


        if (userLocation != null &&
                mission.getLatitude() != null &&
                mission.getLongitude() != null) {

            android.location.Location missionLoc =
                    new android.location.Location("");

            missionLoc.setLatitude(
                    mission.getLatitude()
            );

            missionLoc.setLongitude(
                    mission.getLongitude()
            );


            float distanceInMeters =
                    userLocation.distanceTo(
                            missionLoc
                    );


            distanceStr =
                    String.format(
                            Locale.US,
                            " · %.1f km",
                            distanceInMeters / 1000f
                    );
        }


        String timeStr =
                TimeFormat.relativeTime(
                        mission.getAssignedAt() != null
                                ? mission.getAssignedAt()
                                : mission.getCreatedAt()
                );


        holder.tvSubtitle.setText(
                locationStr +
                        distanceStr +
                        " · " +
                        timeStr
        );


        // =====================================================
        // PRIORITY BORDER
        // =====================================================

        int borderColorRes;


        switch (mission.getPriority()) {

            case URGENT:
            case HIGH:

                borderColorRes =
                        R.color.priority_high_bg;

                break;


            case MEDIUM:

                borderColorRes =
                        R.color.priority_medium_bg;

                break;


            case LOW:

                borderColorRes =
                        R.color.priority_low_bg;

                break;


            default:

                borderColorRes =
                        R.color.priority_other_bg;

                break;
        }


        if (holder.root instanceof MaterialCardView) {

            MaterialCardView card =
                    (MaterialCardView) holder.root;


            card.setStrokeColor(
                    ContextCompat.getColor(
                            holder.itemView.getContext(),
                            borderColorRes
                    )
            );
        }


        // =====================================================
        // MISSION STATE
        // =====================================================

        boolean activeMissionExists =
                hasActiveMission();


        boolean isRunning =
                mission.getStatus() ==
                        MissionStatus.ACKNOWLEDGED ||
                        mission.getStatus() ==
                                MissionStatus.IN_PROGRESS;


        boolean isPaused =
                mission.getStatus() ==
                        MissionStatus.PAUSED;


        boolean isCompleted =
                mission.getStatus() ==
                        MissionStatus.COMPLETED;


        boolean isUrgent =
                mission.getPriority() ==
                        Priority.URGENT;


        boolean canBeStarted =
                mission.getStatus() ==
                        MissionStatus.NEW ||
                        mission.getStatus() ==
                                MissionStatus.ASSIGNED;


        boolean shouldLock =
                activeMissionExists &&
                        !isRunning &&
                        !isUrgent &&
                        !isCompleted;


        // =====================================================
        // RESET RECYCLED VIEW
        // =====================================================

        holder.itemView.setAlpha(
                1f
        );

        holder.itemView.setEnabled(
                true
        );


        holder.btnAction.setAlpha(
                1f
        );

        holder.btnAction.setEnabled(
                true
        );

        holder.btnAction.setVisibility(
                View.VISIBLE
        );


        holder.workTimerRow.setVisibility(
                View.GONE
        );

        holder.lockRow.setVisibility(
                View.GONE
        );


        holder.tvWorkTimeLabel.setText(
                "Work time"
        );

        holder.tvWorkTime.setText(
                "00:00:00"
        );


        // =====================================================
        // RUNNING MISSION
        // =====================================================

        if (isRunning) {

            holder.btnAction.setText(
                    "Stop"
            );


            holder.btnAction.setEnabled(
                    true
            );


            holder.btnAction.setBackgroundTintList(
                    ColorStateList.valueOf(
                            ContextCompat.getColor(
                                    holder.itemView.getContext(),
                                    R.color.urgent_alert
                            )
                    )
            );


            holder.workTimerRow.setVisibility(
                    View.VISIBLE
            );


            holder.tvWorkTimeLabel.setText(
                    "Work time"
            );


            holder.tvWorkTime.setText(
                    formatWorkTime(
                            getLiveDurationSeconds(
                                    mission
                            )
                    )
            );
        }


        // =====================================================
        // PAUSED MISSION
        // =====================================================

        else if (isPaused) {

            holder.btnAction.setText(
                    "Paused"
            );


            holder.btnAction.setEnabled(
                    false
            );


            holder.btnAction.setAlpha(
                    0.55f
            );


            holder.itemView.setAlpha(
                    0.70f
            );


            holder.workTimerRow.setVisibility(
                    View.VISIBLE
            );


            holder.tvWorkTimeLabel.setText(
                    "Work time · Paused"
            );


            holder.tvWorkTime.setText(
                    formatWorkTime(
                            getFixedDurationSeconds(
                                    mission
                            )
                    )
            );
        }


        // =====================================================
        // COMPLETED MISSION
        // =====================================================

        else if (isCompleted) {

            holder.btnAction.setVisibility(
                    View.GONE
            );


            holder.workTimerRow.setVisibility(
                    View.VISIBLE
            );


            holder.tvWorkTimeLabel.setText(
                    "Work time"
            );


            holder.tvWorkTime.setText(
                    formatWorkTime(
                            getFixedDurationSeconds(
                                    mission
                            )
                    )
            );
        }


        // =====================================================
        // NEW / ASSIGNED MISSION
        // =====================================================

        else if (canBeStarted) {

            holder.btnAction.setText(
                    "Start work"
            );


            if (shouldLock) {

                holder.btnAction.setEnabled(
                        false
                );


                holder.btnAction.setAlpha(
                        0.35f
                );


                holder.itemView.setAlpha(
                        0.50f
                );


                holder.itemView.setEnabled(
                        false
                );


                holder.lockRow.setVisibility(
                        View.VISIBLE
                );


                holder.workTimerRow.setVisibility(
                        View.GONE
                );
            }

            else {

                holder.btnAction.setEnabled(
                        true
                );


                holder.btnAction.setAlpha(
                        1f
                );


                holder.itemView.setAlpha(
                        1f
                );


                holder.itemView.setEnabled(
                        true
                );


                holder.btnAction.setBackgroundTintList(
                        ColorStateList.valueOf(
                                ContextCompat.getColor(
                                        holder.itemView.getContext(),
                                        R.color.active_ok
                                )
                        )
                );


                holder.lockRow.setVisibility(
                        View.GONE
                );


                holder.workTimerRow.setVisibility(
                        View.GONE
                );
            }
        }


        // =====================================================
        // OTHER STATUS
        // =====================================================

        else {

            holder.btnAction.setVisibility(
                    View.GONE
            );


            long fixedDuration =
                    getFixedDurationSeconds(
                            mission
                    );


            if (fixedDuration > 0) {

                holder.workTimerRow.setVisibility(
                        View.VISIBLE
                );


                holder.tvWorkTime.setText(
                        formatWorkTime(
                                fixedDuration
                        )
                );
            }
        }


        // =====================================================
        // ACTION BUTTON
        // =====================================================

        holder.btnAction.setOnClickListener(
                v -> {

                    if (!shouldLock &&
                            !isPaused &&
                            !isCompleted) {

                        listener.onActionClick(
                                mission
                        );
                    }
                }
        );


        // =====================================================
        // CARD CLICK
        // =====================================================

        holder.itemView.setOnClickListener(
                v -> {

                    if (!shouldLock ||
                            isPaused ||
                            isCompleted) {

                        listener.onMissionClick(
                                mission
                        );
                    }
                }
        );
    }


    // =========================================================
    // LIVE TIMER
    // =========================================================

    private long getLiveDurationSeconds(
            Mission mission
    ) {

        int missionId =
                mission.getId();


        long backendDuration =
                Math.max(
                        0,
                        mission.getDurationSeconds()
                );


        Long base =
                timerBaseSeconds.get(
                        missionId
                );

        Long baseRealtime =
                timerBaseRealtime.get(
                        missionId
                );


        /*
         * Safety fallback in case the mission reached
         * onBindViewHolder before submitList initialized
         * its timer baseline.
         */
        if (base == null ||
                baseRealtime == null) {

            base =
                    backendDuration;

            baseRealtime =
                    SystemClock.elapsedRealtime();


            timerBaseSeconds.put(
                    missionId,
                    base
            );

            timerBaseRealtime.put(
                    missionId,
                    baseRealtime
            );
        }


        long elapsed =
                Math.max(
                        0,
                        (
                                SystemClock.elapsedRealtime()
                                        - baseRealtime
                        ) / 1000L
                );


        return base +
                elapsed;
    }


    // =========================================================
    // FIXED TIMER
    // =========================================================

    private long getFixedDurationSeconds(
            Mission mission
    ) {

        /*
         * The Missions list API currently provides
         * duration_seconds.
         */
        long duration =
                Math.max(
                        0,
                        mission.getDurationSeconds()
                );


        /*
         * Fallback for responses that may contain
         * worked_seconds instead.
         */
        if (duration == 0) {

            duration =
                    Math.max(
                            0,
                            mission.getWorkedSeconds()
                    );
        }


        return duration;
    }


    // =========================================================
    // FORMAT TIMER
    // =========================================================

    private String formatWorkTime(
            long totalSeconds
    ) {

        if (totalSeconds < 0) {
            totalSeconds = 0;
        }


        long hours =
                totalSeconds / 3600;


        long minutes =
                (totalSeconds % 3600)
                        / 60;


        long seconds =
                totalSeconds % 60;


        return String.format(
                Locale.US,
                "%02d:%02d:%02d",
                hours,
                minutes,
                seconds
        );
    }


    // =========================================================
    // RECYCLER VIEW
    // =========================================================

    @Override
    public int getItemCount() {

        return missions.size();
    }


    @Override
    public void onViewRecycled(
            @NonNull ViewHolder holder
    ) {

        super.onViewRecycled(
                holder
        );


        holder.btnAction.setOnClickListener(
                null
        );


        holder.itemView.setOnClickListener(
                null
        );
    }


    // =========================================================
    // STOP TIMER UPDATES
    // =========================================================

    public void stopTimerUpdates() {

        timerHandler.removeCallbacks(
                timerRunnable
        );
    }


    // =========================================================
    // VIEW HOLDER
    // =========================================================

    static class ViewHolder
            extends RecyclerView.ViewHolder {

        final View root;

        final TextView tvTitle;

        final TextView tvSubtitle;

        final TextView tvPriority;

        final Button btnAction;


        final View workTimerRow;

        final TextView tvWorkTimeLabel;

        final TextView tvWorkTime;


        final View lockRow;

        final TextView tvLockMessage;


        ViewHolder(
                @NonNull View itemView
        ) {

            super(
                    itemView
            );


            root =
                    itemView.findViewById(
                            R.id.root
                    );


            tvTitle =
                    itemView.findViewById(
                            R.id.tvTitle
                    );


            tvSubtitle =
                    itemView.findViewById(
                            R.id.tvSubtitle
                    );


            tvPriority =
                    itemView.findViewById(
                            R.id.tvPriority
                    );


            btnAction =
                    itemView.findViewById(
                            R.id.btnAction
                    );


            workTimerRow =
                    itemView.findViewById(
                            R.id.workTimerRow
                    );


            tvWorkTimeLabel =
                    itemView.findViewById(
                            R.id.tvWorkTimeLabel
                    );


            tvWorkTime =
                    itemView.findViewById(
                            R.id.tvWorkTime
                    );


            lockRow =
                    itemView.findViewById(
                            R.id.lockRow
                    );


            tvLockMessage =
                    itemView.findViewById(
                            R.id.tvLockMessage
                    );
        }
    }
}