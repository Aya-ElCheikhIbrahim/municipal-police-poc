package com.municipalpolice.officerapp.data;

import com.municipalpolice.officerapp.model.Shift;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface ShiftApiService {

    @POST("shifts/start/")
    Call<Shift> startShift(
            @Body PositionRequest request
    );

    @POST("shifts/end/")
    Call<Shift> endShift(
            @Body EndShiftRequest request
    );

    @POST("location-pings/bulk/")
    Call<BulkLocationPingResponse> uploadLocationPings(
            @Body BulkLocationPingRequest request
    );
}