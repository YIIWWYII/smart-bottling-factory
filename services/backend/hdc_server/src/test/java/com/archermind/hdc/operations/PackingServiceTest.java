package com.archermind.hdc.operations;

import com.archermind.hdc.operations.dto.PackingRequest;
import com.archermind.hdc.operations.dto.PackingResponse;
import com.archermind.hdc.operations.service.PackingService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PackingServiceTest {
    @Test
    void calculatesStableGridCoordinates() {
        PackingRequest request = new PackingRequest();
        request.setBottleType("PLA-500");
        request.setBottleWidthMm(70);
        request.setBottleLengthMm(70);
        request.setBottleHeightMm(200);
        request.setBoxWidthMm(300);
        request.setBoxLengthMm(300);
        request.setBoxHeightMm(450);

        PackingResponse response = new PackingService().calculate(request);

        assertTrue(response.isFit());
        assertEquals(32, response.getCount());
        assertEquals(response.getCount(), response.getPlacements().size());
        assertEquals(35.0D, response.getPlacements().get(0).getXMm());
        assertEquals(100.0D, response.getPlacements().get(0).getZMm());
    }
}
