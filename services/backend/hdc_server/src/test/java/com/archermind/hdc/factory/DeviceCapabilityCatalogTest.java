package com.archermind.hdc.factory;

import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeviceCapabilityCatalogTest {
    @Test
    void eachStageHasDistinctDevicesAndControlsExposeSafetyFields() {
        DeviceCapabilityCatalog catalog = new DeviceCapabilityCatalog();

        assertEquals(9, catalog.stageCodes().size());
        assertTrue(catalog.devices("FILLING").contains("FIL-PUMP-01"));
        assertEquals("FILLING", catalog.stageForDevice("FIL-PUMP-01"));
        assertTrue(catalog.controls("FIL-PUMP-01").size() >= 2);
        assertEquals("OPERATOR", catalog.control("FIL-PUMP-01", "SET_FILL_VOLUME").get("requiredRole"));
        assertNotNull(catalog.control("FIL-PUMP-01", "SET_FILL_VOLUME").get("interlocks"));

        for (String item : Arrays.asList(
                "PT-WASH-01:START_WASH_CYCLE", "GAS-PUMP-01:RESAMPLE_GAS",
                "VIS-REJECT-01:REJECT_CURRENT_PRODUCT", "BEV-MIX-01:START_MIXING",
                "FIL-HEAD-01:START_FILLING_CYCLE", "SEC-CAM-01:RECHECK_IMAGE",
                "PK-ARM-01:START_PACKING_PLAN", "AGV-DISPATCH-01:REQUEST_AGV_DISPATCH",
                "WH-WMS-01:CONFIRM_WAREHOUSE_INBOUND")) {
            String[] parts = item.split(":");
            assertNotNull(catalog.control(parts[0], parts[1]), item + " must be exposed by backend");
        }
    }
}
