package com.municipalpolice.officerapp.ui.missions;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.Priority;

import java.util.ArrayList;
import java.util.List;

public class MissionAdapter extends RecyclerView.Adapter<MissionAdapter.ViewHolder> {

    public interface OnMissionClickListener {
        void onMissionClick(Mission mission);
    }

    private final List<Mission> missions = new ArrayList<>();
    private final OnMissionClickListener listener;

    public MissionAdapter(OnMissionClickListener listener) {
        this.listener = listener;
    }

    public void submitList(List<Mission> newMissions) {
        missions.clear();
        missions.addAll(newMissions);
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
        holder.tvSubtitle.setText(mission.getLocation() + " · " + mission.getDistanceMeters());

        int pillRes;
        String priorityLabel;
        switch (mission.getPriority()) {
            case URGENT:
                pillRes = R.drawable.pill_urgent;
                priorityLabel = holder.itemView.getContext().getString(R.string.priority_urgent);
                break;
            case MEDIUM:
                pillRes = R.drawable.pill_pending;
                priorityLabel = holder.itemView.getContext().getString(R.string.priority_medium);
                break;
            default:
                pillRes = R.drawable.pill_active;
                priorityLabel = holder.itemView.getContext().getString(R.string.priority_low);
        }
        holder.tvPriority.setBackgroundResource(pillRes);
        holder.tvPriority.setText(priorityLabel);

        holder.itemView.setOnClickListener(v -> listener.onMissionClick(mission));
    }

    @Override
    public int getItemCount() {
        return missions.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        final TextView tvTitle;
        final TextView tvSubtitle;
        final TextView tvPriority;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvTitle = itemView.findViewById(R.id.tvTitle);
            tvSubtitle = itemView.findViewById(R.id.tvSubtitle);
            tvPriority = itemView.findViewById(R.id.tvPriority);
        }
    }
}
