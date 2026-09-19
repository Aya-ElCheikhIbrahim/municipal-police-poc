package com.municipalpolice.officerapp.ui.missions;

import android.content.res.ColorStateList;
import android.location.Location;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.model.Priority;
import com.municipalpolice.officerapp.util.TimeFormat;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MissionAdapter extends RecyclerView.Adapter<MissionAdapter.ViewHolder> {

    public interface OnMissionClickListener {
        void onMissionClick(Mission mission);
        void onActionClick(Mission mission);
    }

    private final List<Mission> missions = new ArrayList<>();
    private final OnMissionClickListener listener;
    private android.location.Location userLocation;

    public MissionAdapter(OnMissionClickListener listener) {
        this.listener = listener;
    }

    public void submitList(List<Mission> newMissions) {
        missions.clear();
        missions.addAll(newMissions);
        notifyDataSetChanged();
    }

    public void setUserLocation(android.location.Location location) {
        this.userLocation = location;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_mission, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Mission mission = missions.get(position);
        holder.tvTitle.setText(mission.getTitle());
        
        String locationStr = mission.getLocationDisplay();
        String distanceStr = "";
        if (userLocation != null && mission.getLatitude() != null && mission.getLongitude() != null) {
            android.location.Location missionLoc = new android.location.Location("");
            missionLoc.setLatitude(mission.getLatitude());
            missionLoc.setLongitude(mission.getLongitude());
            float distanceInMeters = userLocation.distanceTo(missionLoc);
            distanceStr = String.format(Locale.US, " · %.1f km", distanceInMeters / 1000f);
        }

        String timeStr = TimeFormat.relativeTime(mission.getAssignedAt() != null ? mission.getAssignedAt() : mission.getCreatedAt());
        
        holder.tvSubtitle.setText(locationStr + distanceStr + " · " + timeStr);

        // Background color based on priority
        int bgColorRes;
        switch (mission.getPriority()) {
            case URGENT:
            case HIGH:
                bgColorRes = R.color.priority_high_bg;
                break;
            case MEDIUM:
                bgColorRes = R.color.priority_medium_bg;
                break;
            case LOW:
                bgColorRes = R.color.priority_low_bg;
                break;
            default:
                bgColorRes = R.color.priority_other_bg;
        }
        if (holder.root instanceof com.google.android.material.card.MaterialCardView) {
            ((com.google.android.material.card.MaterialCardView) holder.root).setStrokeColor(ColorStateList.valueOf(ContextCompat.getColor(holder.itemView.getContext(), bgColorRes)));
        } else {
            holder.root.setBackgroundTintList(ColorStateList.valueOf(ContextCompat.getColor(holder.itemView.getContext(), bgColorRes)));
        }

        // Action button text and color based on status
        if (mission.getStatus() == MissionStatus.NEW || mission.getStatus() == MissionStatus.ASSIGNED) {
            holder.btnAction.setText(R.string.mission_step_start);
            holder.btnAction.setBackgroundTintList(ColorStateList.valueOf(ContextCompat.getColor(holder.itemView.getContext(), R.color.active_ok)));
            holder.btnAction.setVisibility(View.VISIBLE);
        } else if (mission.getStatus() == MissionStatus.ACKNOWLEDGED || mission.getStatus() == MissionStatus.IN_PROGRESS) {
            holder.btnAction.setText("Stop");
            holder.btnAction.setBackgroundTintList(ColorStateList.valueOf(ContextCompat.getColor(holder.itemView.getContext(), R.color.urgent_alert)));
            holder.btnAction.setVisibility(View.VISIBLE);
        } else {
            holder.btnAction.setVisibility(View.GONE);
        }

        holder.btnAction.setOnClickListener(v -> listener.onActionClick(mission));
        holder.itemView.setOnClickListener(v -> listener.onMissionClick(mission));
    }

    @Override
    public int getItemCount() {
        return missions.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        final View root;
        final TextView tvTitle;
        final TextView tvSubtitle;
        final TextView tvPriority;
        final Button btnAction;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            root = itemView.findViewById(R.id.root);
            tvTitle = itemView.findViewById(R.id.tvTitle);
            tvSubtitle = itemView.findViewById(R.id.tvSubtitle);
            tvPriority = itemView.findViewById(R.id.tvPriority);
            btnAction = itemView.findViewById(R.id.btnAction);
        }
    }
}
