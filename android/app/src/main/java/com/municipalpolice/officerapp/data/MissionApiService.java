package com.municipalpolice.officerapp.data;

import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionPhoto;
import java.util.List;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.http.*;

public interface MissionApiService {
    @GET("missions/")
    Call<List<Mission>> getMissions(@Query("status") String status, @Query("open") Boolean open);

    @GET("missions/{id}/")
    Call<Mission> getMissionDetail(@Path("id") int id);

    @POST("missions/{id}/acknowledge/")
    Call<Mission> acknowledgeMission(@Path("id") int id);

    @POST("missions/{id}/start/")
    Call<Mission> startMission(@Path("id") int id, @Body PositionRequest request);

    @POST("missions/{id}/complete/")
    Call<Mission> completeMission(@Path("id") int id, @Body CompleteMissionRequest request);

    @POST("missions/{id}/cancel/")
    Call<Mission> cancelMission(@Path("id") int id, @Body CancelMissionRequest request);

    @POST("missions/{id}/notes/")
    Call<Mission> addNote(@Path("id") int id, @Body NoteRequest request);

    @Multipart
    @POST("missions/{id}/photos/")
    Call<MissionPhoto> uploadPhoto(
        @Path("id") int id,
        @Part("client_uuid") RequestBody clientUuid,
        @Part MultipartBody.Part image,
        @Part("captured_latitude") RequestBody latitude,
        @Part("captured_longitude") RequestBody longitude,
        @Part("captured_at") RequestBody capturedAt
    );
}
