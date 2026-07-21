package com.archermind.hdc.operations.service;

import com.archermind.hdc.operations.dto.PackingPlacement;
import com.archermind.hdc.operations.dto.PackingRequest;
import com.archermind.hdc.operations.dto.PackingResponse;
import org.springframework.stereotype.Service;

@Service
public class PackingService {
    public PackingResponse calculate(PackingRequest request) {
        if (request == null) throw new IllegalArgumentException("request is required");
        validatePositive(request.getBottleWidthMm(), "bottleWidthMm");
        validatePositive(request.getBottleLengthMm(), "bottleLengthMm");
        validatePositive(request.getBottleHeightMm(), "bottleHeightMm");
        validatePositive(request.getBoxWidthMm(), "boxWidthMm");
        validatePositive(request.getBoxLengthMm(), "boxLengthMm");
        validatePositive(request.getBoxHeightMm(), "boxHeightMm");

        Orientation best = new Orientation(request.getBottleWidthMm(), request.getBottleLengthMm(), 0);
        if (request.isAllowRotation()) {
            Orientation rotated = new Orientation(request.getBottleLengthMm(), request.getBottleWidthMm(), 90);
            if (rotated.count(request) > best.count(request)) best = rotated;
        }

        PackingResponse response = new PackingResponse();
        response.setBottleType(request.getBottleType());
        response.setRows(best.rows(request));
        response.setColumns(best.columns(request));
        response.setLayers((int) Math.floor(request.getBoxHeightMm() / request.getBottleHeightMm()));
        response.setCount(best.count(request));
        response.setFit(response.getCount() > 0);
        response.setMessage(response.isFit()
                ? "Grid packing coordinates calculated; verify gripper clearance before REAL mode"
                : "Bottle dimensions do not fit this box");

        int index = 1;
        for (int layer = 0; layer < response.getLayers(); layer++) {
            for (int row = 0; row < response.getRows(); row++) {
                for (int column = 0; column < response.getColumns(); column++) {
                    PackingPlacement placement = new PackingPlacement();
                    placement.setIndex(index++);
                    placement.setLayer(layer);
                    placement.setRow(row);
                    placement.setColumn(column);
                    placement.setXMm((column + 0.5D) * best.width);
                    placement.setYMm((row + 0.5D) * best.length);
                    placement.setZMm((layer + 0.5D) * request.getBottleHeightMm());
                    placement.setRotationDeg(best.rotationDeg);
                    response.getPlacements().add(placement);
                }
            }
        }
        return response;
    }

    private void validatePositive(double value, String name) {
        if (value <= 0) throw new IllegalArgumentException(name + " must be greater than 0");
    }

    private static class Orientation {
        private final double width;
        private final double length;
        private final double rotationDeg;

        private Orientation(double width, double length, double rotationDeg) {
            this.width = width;
            this.length = length;
            this.rotationDeg = rotationDeg;
        }

        private int columns(PackingRequest request) {
            return (int) Math.floor(request.getBoxWidthMm() / width);
        }

        private int rows(PackingRequest request) {
            return (int) Math.floor(request.getBoxLengthMm() / length);
        }

        private int count(PackingRequest request) {
            return columns(request) * rows(request)
                    * (int) Math.floor(request.getBoxHeightMm() / request.getBottleHeightMm());
        }
    }
}
