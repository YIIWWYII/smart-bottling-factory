package com.archermind.hdc.factory;

import com.archermind.hdc.factory.capability.DeviceCapabilityCatalog;
import org.junit.jupiter.api.Test;

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
        assertEquals(2, catalog.controls("FIL-PUMP-01").size());
        assertEquals("OPERATOR", catalog.control("FIL-PUMP-01", "SET_FILL_VOLUME").get("requiredRole"));
        assertNotNull(catalog.control("FIL-PUMP-01", "SET_FILL_VOLUME").get("interlocks"));
    }
}
